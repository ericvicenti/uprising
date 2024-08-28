import { createWSServer } from '@rise-tools/server';

import { eg as egInfo } from './eg';
import { getEGLiveFrame, getEGReadyFrame, getSequenceActiveItem } from './eg-main';
import { egSacnService } from './eg-sacn';
import { mainVideo } from './eg-video-playback';
import { createEGViewServer } from './eg-view-server';
import { initMidiController } from './midi';
import { models } from './models';
import { bounceTimes, goNext, mainState, mainStateUpdate, updateScene } from './state';
import { MainState, Scene } from './state-schema';
// import { compare } from 'fast-json-patch';
import { DefaultTransitionDuration } from './constants';

initMidiController();

const sacn = egSacnService(egInfo);
const liveViewServer = createEGViewServer(3889);
const readyViewServer = createEGViewServer(3888);

const recentGradientValues: Record<string, number> = {};

function mainLoop() {
  const nowTime = Date.now();
  const relativeTime = nowTime - startTime;

  // console.log(Object.keys(recentGradientValues))
  // wsServer.update("relativeTime", relativeTime);
  const currentMainState = mainState.get();
  if (!currentMainState) return;
  const context = {
    time: startTime,
    nowTime,
    relativeTime,
    video: mainVideo,
    recentGradientValues,
    bounceTimes,
    mainState: currentMainState,
  };
  const egReadyFrame = getEGReadyFrame(currentMainState, context);
  const egLiveFrame = getEGLiveFrame(currentMainState, context, egReadyFrame);
  sacn.sendFrame(egLiveFrame);
  liveViewServer.sendFrame(egLiveFrame);
  readyViewServer.sendFrame(egReadyFrame);
}

const mainAnimationFPS = 30;

const wsServer = createWSServer(models, 3990);

const startTime = Date.now();
const startTimeExact = performance.now();

const desiredMsPerFrame = 1000 / mainAnimationFPS;

performMainLoopStep(desiredMsPerFrame);

const initTime = performance.now();
const lastFrameTime: number = initTime;

mainLoop();

let frameCount = 0;

function performMainLoopStep(inMs: number) {
  const frameScheduleTime = performance.now();
  setTimeout(() => {
    const preFrameTime = performance.now();
    mainLoop();
    frameCount += 1;
    const afterFrameTime = performance.now();
    const frameDuration = afterFrameTime - preFrameTime;
    if (frameDuration > desiredMsPerFrame) {
      // production is running slow and this is very noisy
      // console.log('frame took too long', frameDuration)
    }
    const frameIdealStartTime = initTime + frameCount * desiredMsPerFrame;
    if (afterFrameTime > frameIdealStartTime) {
      // console.log('frame behind', afterFrameTime - frameIdealStartTime)
      // missed this frame. just go to the next one
      frameCount += 1;
      performMainLoopStep(0);
      return;
    }
    performMainLoopStep(Math.max(1, frameIdealStartTime - afterFrameTime));
  }, inMs);
}

const sequenceTransitionEnds: Record<string, undefined | NodeJS.Timeout> = {};
const sequenceAutoTransitions: Record<string, undefined | NodeJS.Timeout> = {};
const sequenceVideoEndTransitions: Record<string, undefined | NodeJS.Timeout> = {};

// let isMidiTouchingManualTransition = false;

let prevState: MainState | null = null;

setInterval(() => {
  const state = mainState.get();
  if (!state) return;
  if (state.transitionState.manual === 1) {
    mainStateUpdate((state) => ({
      ...state,
      readyScene: state.liveScene,
      liveScene: state.readyScene,
      transitionState: { manual: null, autoStartTime: null },
    }));
  } else if (state.transitionState.autoStartTime) {
    const timeSinceStart = Date.now() - state.transitionState.autoStartTime;
    const duration = state.transition.duration;
    const autoTransitionProgress = timeSinceStart / duration;
    const destProgress = Math.min(1, autoTransitionProgress);
    if (destProgress == 1) {
      mainStateUpdate((state) => ({
        ...state,
        readyScene: state.liveScene,
        liveScene: state.readyScene,
        liveDashboard: state.readyDashboard,
        readyDashboard: state.liveDashboard,
        liveSliderFields: state.readySliderFields,
        readySliderFields: state.liveSliderFields,
        transitionState: {
          manual: null,
          autoStartTime: null,
        },
      }));
      return;
    }
  }
}, 100);

mainState.subscribe((state) => {
  if (!state) return;
  if (prevState) {
    // const patch = compare(prevState, state);
    // console.log('MainState update', patch);
    // console.log(state);
  } else {
    // handle state loaded..?
  }
  // init all video players
  matchAllScenes(state, (scene, controlPath) => {
    const mainScenePath = controlPath[0];
    if (scene.type === 'video') {
      const player = mainVideo.getPlayer(scene.id);
      if (scene.params) player.setParams(scene.params);
      if (scene.track) player.selectVideo(scene.track);
      return true;
    }
    return false;
  });

  // handle auto transitioning with maxDuration
  // matchAllScenes(state, (media, controlPath) => {
  //   if (media.type === 'sequence') {
  //     const activeItem = getSequenceActiveItem(media);
  //     if (!activeItem || !activeItem.maxDuration) {
  //       return false;
  //     }
  //     const controlPathString = controlPath.join('.');
  //     clearTimeout(sequenceAutoTransitions[controlPathString]);
  //     const maxDurationMs = 1_000 * activeItem.maxDuration;
  //     const timeUntilMaxDuration = media.transitionStartTime
  //       ? media.transitionStartTime + maxDurationMs - Date.now()
  //       : maxDurationMs;
  //     sequenceAutoTransitions[controlPathString] = setTimeout(
  //       () => {
  //         // delete sequenceVideoEndTransitions[controlPathString];
  //         delete sequenceAutoTransitions[controlPathString];
  //         goNext(controlPath);
  //       },
  //       Math.max(1, timeUntilMaxDuration)
  //     );
  //     return true;
  //   }
  //   return false;
  // });
  handleSequenceTransitionEnding(state);
  handleSequenceTransitionStarting(state);
  // handleAudioPlayback(state, prevState);
  prevState = state;
});

// const audioPlayers: Record<string, AudioPlayer> = {};

// function handleAudioPlayback(state: MainState, prevState: MainState) {
//   const isFirstEffect = prevState === state;
//   const prevVideoNodes = isFirstEffect
//     ? []
//     : matchActiveScene(prevState, (media) => media.type === "video");
//   const videoNodes = matchActiveScene(state, (media) => media.type === "video");
//   const videoNodesToStart = videoNodes.filter(
//     (videoNode) =>
//       !prevVideoNodes.some(
//         (prevVideoNode) => prevVideoNode[1].id === videoNode[1].id
//       )
//   );
//   const videoNodesToStop = prevVideoNodes.filter(
//     (prevVideoNode) =>
//       !videoNodes.some((videoNode) => prevVideoNode[1].id === videoNode[1].id)
//   );
//   videoNodesToStart.forEach(([controlPath, media]) => {
//     if (media.type !== "video") return;
//     const player = mainVideo.getPlayer(media.id);
//     if (!player) return;
//     setTimeout(() => {
//       const info = player.getInfo();
//       if (!info?.audioFile) return;
//       if (!audioPlayers[media.id]) {
//         audioPlayers[media.id] = playAudio(
//           join(controlPath, info.audioFile)
//         );
//       }
//     }, 20);
//     console.log("starting audio", player.getInfo());
//   });

//   videoNodesToStop.forEach(([controlPath, media]) => {
//     if (media.type !== "video") return;
//     const audioPlayer = audioPlayers[media.id];
//     if (!audioPlayer) return;
//     audioPlayer.stop();
//     delete audioPlayers[media.id];
//   });
//   // console.log('videoNodesToStart', videoNodesToStart)
//   // console.log('videoNodesToStop', videoNodesToStop)
// }

function handleSequenceTransitionEnding(state: MainState) {
  if (!state) return;
  matchAllScenes(state, (scene, controlPath) => {
    if (scene.type !== 'sequence') return false;
    const controlPathString = controlPath.join(':');
    const { transitionEndTime, transition, nextActiveKey } = scene;
    if (transitionEndTime && nextActiveKey && transition) {
      // handle video transition ending
      clearTimeout(sequenceTransitionEnds[controlPathString]);
      const now = Date.now();
      const timeRemaining = transitionEndTime - now;
      sequenceTransitionEnds[controlPathString] = setTimeout(
        () => {
          delete sequenceTransitionEnds[controlPathString];
          updateScene(controlPath, (scene: Scene): Scene => {
            if (scene.type !== 'sequence') return scene;
            const { nextActiveKey } = scene;
            if (!nextActiveKey) return scene;
            return {
              ...scene,
              transitionEndTime: Date.now(),
              transitionStartTime: undefined,
              activeKey: nextActiveKey,
              nextActiveKey: undefined,
            };
          });
          // goNext(controlPath)
        },
        Math.max(1, timeRemaining)
      );
      return true;
    }
    return false;
  });
}

function handleSequenceTransitionStarting(state: MainState) {
  matchAllScenes(state, (scene, controlPath) => {
    if (scene.type !== 'sequence') return false;
    const controlPathString = controlPath.join(':');
    const activeItem = getSequenceActiveItem(scene);
    if (!activeItem) return false;
    clearTimeout(sequenceVideoEndTransitions[controlPathString]);
    // this is approximate because it depends on the (dropped) frames, so we frequently re-run handleSequenceTransitionStarting
    let approxTimeRemaining: number | undefined = undefined;
    if (scene.transitionStartTime) {
      // mid transition. no need to schedule a transition start
      return false;
    }
    if (activeItem.scene.type === 'video' && activeItem.goNextOnEnd) {
      const player = mainVideo.getPlayer(activeItem.scene.id);
      if (!player) return false;
      const playingFrame = player.getPlayingFrame();
      const frameCount = player.getFrameCount();
      if (playingFrame === null || frameCount === null) return false;
      const framesRemaining = frameCount - playingFrame;
      const transitionDuration = scene.transition?.duration || DefaultTransitionDuration;
      approxTimeRemaining = (1000 * framesRemaining) / mainAnimationFPS - transitionDuration;
    }
    if (activeItem.maxDuration && scene.transitionEndTime) {
      const maxDuration = activeItem.maxDuration * 1000;
      const maxDurationRemaining = scene.transitionEndTime - Date.now() + maxDuration;
      approxTimeRemaining = approxTimeRemaining
        ? Math.min(approxTimeRemaining, maxDurationRemaining)
        : maxDurationRemaining;
    }
    if (approxTimeRemaining) {
      sequenceVideoEndTransitions[controlPathString] = setTimeout(
        () => {
          delete sequenceVideoEndTransitions[controlPathString];
          delete sequenceAutoTransitions[controlPathString];
          goNext(controlPath);
        },
        Math.max(1, approxTimeRemaining)
      );
    }
    return true;
  });
}

setInterval(() => {
  const state = mainState.get();
  if (!state) return;
  handleSequenceTransitionStarting(state);
}, 100);

function fetchMedia(scene: Scene, path: string[]): [string[], Scene][] {
  if (scene.type === 'layers') {
    return [
      [path, scene],
      ...scene.layers.flatMap((layer) => fetchMedia(layer.scene, [...path, `layer_${layer.key}`])),
    ];
  }
  if (scene.type === 'sequence') {
    return [[path, scene], ...scene.sequence.flatMap((item) => fetchMedia(item.scene, [...path, `item_${item.key}`]))];
  }
  return [[path, scene]];
}

function fetchAllScenes(state: MainState): [string[], Scene][] {
  return [...fetchMedia(state.liveScene, ['live']), ...fetchMedia(state.readyScene, ['ready'])];
}

function matchAllScenes(
  state: MainState,
  filter: (scene: Scene, controlPath: string[]) => boolean
): [string[], Scene][] {
  const allMedia = fetchAllScenes(state);
  return allMedia.filter(([controlPath, scene]) => filter(scene, controlPath));
}

// let manualTapBeatCount = 0
// let manualTapBeatStart = 0
// let manualTapBeatLastTime = 0
// let manualTapBeatTimeout: undefined | NodeJS.Timeout = undefined

// function handleManualTapBeat() {
//   const now = Date.now()
//   manualTapBeatCount += 1
//   manualTapBeatLastTime = now
//   if (manualTapBeatStart === 0) {
//     manualTapBeatStart = now
//   }
//   if (manualTapBeatCount > 2) {
//     const bpm = (manualTapBeatCount - 1) / ((now - manualTapBeatStart) / 60_000)
//     const lastBeatTime = now
//     console.log('manual tap beat update', bpm, lastBeatTime)
//     mainStateUpdate((state) => ({
//       ...state,
//       manualBeat: { ...state.manualBeat, bpm, lastBeatTime: manualTapBeatLastTime },
//     }))
//   }

//   clearTimeout(manualTapBeatTimeout)
//   manualTapBeatTimeout = setTimeout(() => {
//     manualTapBeatCount = 0
//     manualTapBeatStart = 0
//     manualTapBeatLastTime = 0
//   }, 2000)
// }

// wsServer.onActionEvent((event) => {
//   const {
//     target: { key, propKey },
//   } = event;
//   // if (key === "offButton" && propKey === "onPress") {
//   //   mainStateUpdate((state) => ({ ...state, mode: "off" }));
//   //   return;
//   // }
//   // if (key === "mode" && propKey === "onValueChange") {
//   //   mainStateUpdate((state) => ({ ...state, mode: event.payload }));
//   //   return;
//   // }
//   // if (sliderUpdate(event, "hueSlider", ["color", "h"])) return;
//   // if (sliderUpdate(event, "saturationSlider", ["color", "s"])) return;
//   // if (sliderUpdate(event, "lightnessSlider", ["color", "l"])) return;
//   // if (sliderUpdate(event, "intensitySlider", ["beatEffect", "intensity"]))
//   //   return;
//   // if (sliderUpdate(event, "waveLengthSlider", ["beatEffect", "waveLength"]))
//   //   return;
//   // if (sliderUpdate(event, "dropoffSlider", ["beatEffect", "dropoff"])) return;
//   // if (switchUpdate(event, "manualBeatEnabledSwitch", ["manualBeat", "enabled"]))
//   //   return;
//   // if (action === 'manualTapBeat') {
//   //   handleManualTapBeat()
//   //   return
//   // }
//   // if (key === 'effectSelect' && name === 'onValueChange') {
//   //   mainStateUpdate((state) => ({
//   //     ...state,
//   //     beatEffect: {
//   //       ...state.beatEffect,
//   //       effect: event.payload as MainState['beatEffect']['effect'],
//   //     },
//   //   }))
//   //   return
//   // }
//   // if (key === 'selectVideo' && name === 'onValueChange') {
//   //   mainStateUpdate((state) => ({
//   //     ...state,
//   //     video: { ...state.video, track: event.payload as string },
//   //   }))
//   //   return
//   // }
//   console.log(event);
//   if (handleMediaEvent(event)) return;
//   if (handleTransitionEvent(event)) return;
//   if (handleEffectEvent(event)) return;
//   if (updateValuesIndex(event)) return;
//   if (handleLibraryEvent(event)) return;
//   if (handleDashboardEvent(event)) return;

//   console.log("Unknown event", event);
// });

// function handleDashboardEvent(event: any): boolean {
//   if (event.dataState.action?.[0] !== "dashboardItem") {
//     return false;
//   }
//   const rootMediaKey = event.dataState.action?.[1];
//   const action = event.dataState.action?.[2];
//   if (action === "remove") {
//     const item = event.dataState.action?.[3];
//     console.log("removing", rootMediaKey, item);
//     mainStateUpdate((state) => {
//       const dashboardKey =
//         rootMediaKey === "liveScene" ? "liveDashboard" : "readyDashboard";
//       return {
//         ...state,
//         [dashboardKey]: state[dashboardKey].filter((i) => i.key !== item),
//       };
//     });
//     return true;
//   }
//   return true;
// }

// function updateSliderField(
//   mainStateKey: "liveScene" | "readyScene",
//   sliderPath: string,
//   updater: (state: SliderField | undefined) => SliderField
// ) {
//   mainStateUpdate((state) => {
//     const slidersKey =
//       mainStateKey === "liveScene" ? "liveSliderFields" : "readySliderFields";
//     const sliders = state[slidersKey];
//     return {
//       ...state,
//       [slidersKey]: {
//         ...sliders,
//         [sliderPath]: updater(sliders[sliderPath]),
//       },
//     };
//   });
// }

// function updateValuesIndex(event: ActionEvent): boolean {
//   const { action } = event.dataState;
//   const actionName = action?.[0];
//   if (actionName !== "updateValuesIndex") {
//     return false;
//   }
//   const key = action?.[1];
//   const field = action?.[2];
//   const [mainStateKey, ...restKey] = key.split(".") as [
//     "liveScene" | "readyScene",
//     string[],
//   ];
//   const sliderKey = restKey.join(".");
//   if (field === "smoothing") {
//     updateSliderField(mainStateKey, sliderKey, (slider) => ({
//       ...slider,
//       smoothing: event.payload[0],
//     }));
//     return true;
//   }
//   if (field === "bounceAmount") {
//     updateSliderField(mainStateKey, sliderKey, (slider) => ({
//       ...slider,
//       bounceAmount: event.payload[0],
//     }));
//     return true;
//   }
//   if (field === "bounceDuration") {
//     updateSliderField(mainStateKey, sliderKey, (slider) => ({
//       ...slider,
//       bounceDuration: event.payload[0],
//     }));
//     return true;
//   }
//   if (field === "bounce") {
//     bounceField(key);
//     return true;
//   }
//   if (field === "value") {
//     updateSliderValue(action[1], event.payload[0]);
//     return true;
//   }
//   if (field === "set") {
//     const value = action[3];
//     updateSliderValue(key, value);
//     return true;
//   }
//   if (field === "addDashBounce") {
//     addToDashboard(key, "bounceButton");
//     return true;
//   }
//   if (field === "addDashSlider") {
//     addToDashboard(key, "slider", action?.[3]);
//     return true;
//   }
//   return false;
// }

// function mediaSliderUpdate(
//   sliderPath: string[],
//   media: Media,
//   value: number
// ): Media {
//   if (sliderPath.length === 0) return media;
//   const [subMediaKey, ...restSliderPath] = sliderPath;
//   if (subMediaKey === "effects") {
//     if (media.type !== "video") return media;
//     const [effectKey, effectField] = restSliderPath;
//     return {
//       ...media,
//       effects: media.effects?.map((effect) => {
//         if (effect.key !== effectKey) return effect;
//         return { ...effect, [effectField]: value };
//       }),
//     };
//   }
//   if (subMediaKey === "layer") {
//     if (media.type !== "layers") return media;
//     const [layerKey, ...restPath] = restSliderPath;
//     // console.log('trying to update layer', layerKey, restPath, value)
//     const [layerField] = restPath;
//     if (layerField === "blendAmount") {
//       console.log("updating blendAmount", layerKey, media, value);
//       return {
//         ...media,
//         layers: media.layers?.map((layer) => {
//           if (layer.key !== layerKey) return layer;
//           return {
//             ...layer,
//             blendAmount: value,
//           };
//         }),
//       };
//     }
//     return {
//       ...media,
//       layers: media.layers?.map((layer) => {
//         if (layer.key !== layerKey) return layer;
//         return {
//           ...layer,
//           media: mediaSliderUpdate(restPath, layer.media, value),
//         };
//       }),
//     };
//   }
//   if (subMediaKey === "item") {
//     if (media.type !== "sequence") return media;
//     const [itemKey, ...restPath] = restSliderPath;
//     return {
//       ...media,
//       sequence: media.sequence?.map((item) => {
//         if (item.key !== itemKey) return item;
//         return {
//           ...item,
//           media: mediaSliderUpdate(restPath, item.media, value),
//         };
//       }),
//     };
//   }
//   return media;
// }

// function updateSliderValue(fieldPath: string, value: number) {
//   console.log("update slider", fieldPath, value);
//   const [rootMediaKey, ...restFieldPath] = fieldPath.split(".");
//   if (rootMediaKey !== "liveScene" && rootMediaKey !== "readyScene") return;
//   mainStateUpdate((state) => {
//     const media =
//       rootMediaKey === "liveScene" ? state.liveScene : state.readyScene;
//     return {
//       ...state,
//       [rootMediaKey]: mediaSliderUpdate(restFieldPath, media, value),
//     };
//   });
// }

// function addToDashboard(
//   mediaKey: string,
//   behavior: "slider" | "bounceButton" | "goNextButton",
//   opts?: {
//     min?: number;
//     max?: number;
//     step?: number;
//   }
// ) {
//   console.log("add to dash", mediaKey, behavior, opts);
//   const controlPath = mediaKey.split(".");
//   const [rootMediaKey, ...restMediaPath] = controlPath;
//   if (rootMediaKey === "liveScene" || rootMediaKey === "readyScene") {
//     mainStateUpdate((state) => {
//       const dashboardKey =
//         rootMediaKey === "liveScene" ? "liveDashboard" : "readyDashboard";
//       const prevDashboard = state[dashboardKey];
//       return {
//         ...state,
//         [dashboardKey]: [
//           ...prevDashboard,
//           {
//             key: randomUUID(),
//             field: restMediaPath.join("."),
//             behavior,
//             ...opts,
//           },
//         ],
//       };
//     });
//     return;
//   }
//   console.warn(
//     "Cannot add to dash from to non-media. hide this button from the UI."
//   );
// }

// function handleEffectEvent(event: ActionEvent): boolean {
//   const { action } = event.dataState;
//   const actionName = action?.[0];
//   if (actionName !== "updateEffect") {
//     return false;
//   }

//   const fullEffectPath = action?.[1].split(".");
//   const effectField = action?.[2];

//   const controlPath = fullEffectPath.slice(0, -2);
//   if (fullEffectPath.at(-2) !== "effects") {
//     console.warn("Invalid effect path");
//     return false;
//   }
//   const effectKey = fullEffectPath.at(-1);

//   if (!controlPath || !effectKey || !effectField) {
//     console.warn("Invalid effect event", event);
//     return false;
//   }

//   rootSceneUpdate(controlPath, (media): Media => {
//     if (media.type !== "video" || !media.effects) {
//       return media;
//     }
//     const effectIndex = media.effects.findIndex(
//       (effect) => effect.key === effectKey
//     );
//     if (effectIndex === -1) {
//       return media;
//     }
//     if (effectField === "remove") {
//       return {
//         ...media,
//         effects: media.effects.filter((effect) => {
//           return effect.key !== effectKey;
//         }),
//       };
//     }
//     if (effectIndex != null && effectIndex !== -1) {
//       const effect = media.effects[effectIndex];
//       const newEffect = { ...effect, [effectField]: event.payload[0] };
//       return {
//         ...media,
//         effects: media.effects.map((effect) => {
//           if (effect.key === effectKey) {
//             return newEffect;
//           }
//           return effect;
//         }),
//       };
//     }
//     return media;
//   });
//   return true;
// }

// function startAutoTransition() {
//   mainStateUpdate((state) => ({
//     ...state,
//     transitionState: {
//       ...state.transitionState,
//       autoStartTime: Date.now(),
//     },
//   }));
// }

// function setManualTransition(value: number) {
//   mainStateUpdate((state) => ({
//     ...state,
//     transitionState: {
//       ...state.transitionState,
//       manual: value,
//     },
//   }));
// }

// function handleTransitionEvent(event: ActionEvent): boolean {
//   if (event.dataState.action?.[0] !== "updateTransition") {
//     return false;
//   }
//   const transitionKey = event.dataState.action?.[1];
//   if (transitionKey !== "mainTransition")
//     throw new Error("Invalid transition key");
//   if (event.dataState.action?.[2] === "manual") {
//     isMidiTouchingManualTransition = false;
//     setManualTransition(event.payload[0]);
//     return true;
//   }
//   if (event.dataState.action?.[2] === "duration") {
//     mainStateUpdate((state) => ({
//       ...state,
//       transition: {
//         ...state.transition,
//         duration: event.payload[0],
//       },
//     }));
//     return true;
//   }
//   if (event.dataState.action?.[2] === "startAuto") {
//     startAutoTransition();
//     return true;
//   }
//   if (event.dataState.action?.[2] === "mode") {
//     mainStateUpdate((state) => ({
//       ...state,
//       transition: {
//         ...state.transition,
//         mode: event.payload,
//       },
//     }));
//     return true;
//   }
//   return false;
// }

// function mediaUpdate(
//   controlPath: string[],
//   prevMedia: Media,
//   updater: (media: Media) => Media
// ): Media {
//   if (controlPath.length === 0) return updater(prevMedia);
//   const [subMediaKey, ...restMediaPath] = controlPath;
//   if (subMediaKey === "layer" && prevMedia.type === "layers") {
//     const [layerKey, ...subMediaPath] = restMediaPath;
//     return {
//       ...prevMedia,
//       layers: prevMedia.layers?.map((layer) => {
//         if (layer.key === layerKey) {
//           return {
//             ...layer,
//             media: mediaUpdate(subMediaPath, layer.media, updater),
//           };
//         }
//         return layer;
//       }),
//     };
//   }
//   if (subMediaKey === "item" && prevMedia.type === "sequence") {
//     const [layerKey, ...subMediaPath] = restMediaPath;
//     return {
//       ...prevMedia,
//       sequence: prevMedia.sequence?.map((item) => {
//         if (item.key === layerKey) {
//           return {
//             ...item,
//             media: mediaUpdate(subMediaPath, item.media, updater),
//           };
//         }
//         return item;
//       }),
//     };
//   }

//   throw new Error(
//     `Unhandled deep mediaUpdate: ${JSON.stringify({ subMediaKey, restMediaPath, prevMedia })}`
//   );
// }

// function rootSceneUpdate(
//   controlPath: string[],
//   updater: (media: Media) => Media
// ) {
//   const [rootMediaKey, ...restMediaPath] = controlPath;
//   if (rootMediaKey !== "liveScene" && rootMediaKey !== "readyScene") {
//     throw new Error("Invalid root media key");
//   }
//   mainStateUpdate((state) => {
//     const prevMedia = state[rootMediaKey];
//     return {
//       ...state,
//       [rootMediaKey]: mediaUpdate(restMediaPath, prevMedia, updater),
//     };
//   });
// }

// function handleLibraryEvent(event: ActionEvent): boolean {
//   if (event.dataState.action?.[0] !== "libraryAction") {
//     return false;
//   }
//   const libraryKey = event.dataState.action?.[1];
//   const action = event.dataState.action?.[2];
//   if (action === "goReady" && libraryKey) {
//     const libraryItem = readLibraryKey(libraryKey);
//     if (!libraryItem) {
//       console.warn("item not found " + libraryKey);
//       return true;
//     }
//     mainStateUpdate((mainState) => ({
//       ...mainState,
//       readyScene: libraryItem.media,
//       readyDashboard: libraryItem.dashboard,
//       readySliderFields: libraryItem.sliders,
//     }));
//     return true;
//   }
//   if (action === "delete" && libraryKey) {
//     deleteLibraryKey(libraryKey);
//     return true;
//   }
//   return false;
// }

// function getSceneSliders(
//   state: MainState,
//   controlPath: string[]
// ): Record<string, SliderField> | null {
//   if (controlPath.length === 1 && controlPath[0] === "liveScene") {
//     return state.liveSliderFields;
//   }
//   if (controlPath.length === 1 && controlPath[0] === "readyScene") {
//     return state.readySliderFields;
//   }
//   return null;
// }

// function getSceneDashboard(
//   state: MainState,
//   controlPath: string[]
// ): DashboardItem[] | null {
//   if (controlPath.length === 1 && controlPath[0] === "liveScene") {
//     return state.liveDashboard;
//   }
//   if (controlPath.length === 1 && controlPath[0] === "readyScene") {
//     return state.readyDashboard;
//   }
//   return null;
// }

// function handleMediaEvent(event: ActionEvent): boolean {
//   if (event.dataState.action?.[0] !== "updateMedia") {
//     return false;
//   }

//   const controlPath = event.dataState.action?.[1]?.split(".");
//   const action = event.dataState.action?.[2];
//   if (!controlPath || !action) {
//     console.warn("Invalid media event", event);
//     return false;
//   }
//   if (action === "saveMedia") {
//     const mediaValue = getScene(mainState, controlPath);
//     if (!mediaValue) return true;
//     const key = `${getSceneTitle(mediaValue, uiContext)} - ${new Date().toLocaleString()}`;
//     saveMedia(key, {
//       media: mediaValue,
//       sliders: getSceneSliders(mainState, controlPath),
//       dashboard: getSceneDashboard(mainState, controlPath),
//     });
//     return true;
//   }
//   if (action === "metadata") {
//     rootSceneUpdate(controlPath, (media) => ({
//       ...media,
//       label: event.payload.label,
//     }));
//     return true;
//   }
//   if (action === "clear") {
//     rootSceneUpdate(controlPath, () => createBlankScene("off"));
//     return true;
//   }
//   if (action === "mode") {
//     const mode = event.payload;
//     rootSceneUpdate(controlPath, () => createBlankScene(mode));
//     return true;
//   }
//   if (action === "color") {
//     const colorField = event.dataState.action?.[3];
//     const number = event.payload[0];
//     if (colorField === "h" || colorField === "s" || colorField === "l") {
//       rootSceneUpdate(controlPath, (media) => ({
//         ...media,
//         [colorField]: number,
//       }));
//       return true;
//     }
//   }
//   if (action === "track") {
//     const track = event.payload;
//     rootSceneUpdate(controlPath, (media) => ({ ...media, track }));
//     return true;
//   }
//   if (action === "restart") {
//     const media = getScene(mainState, controlPath);
//     if (media?.type === "video") {
//       const player = mainVideo.getPlayer(media.id);
//       if (player) {
//         player.restart();
//       }
//     }
//     return true;
//   }
//   if (action === "pause") {
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("pause on non-video media", media);
//         return media;
//       }
//       const { id } = media;
//       const player = mainVideo.getPlayer(id);
//       if (!player) {
//         console.warn("cannot get player for pausing", media);
//       }
//       const pauseOnFrame = player?.getPlayingFrame() || 0;
//       console.log("pausing", media);
//       return { ...media, pauseOnFrame };
//     });
//     return true;
//   }
//   if (action === "play") {
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("play on non-video media", media);
//         return media;
//       }
//       return { ...media, pauseOnFrame: null };
//     });
//     return true;
//   }
//   if (action === "loopBounce") {
//     const loopBounce = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("loopBounce on non-video media", media);
//         return media;
//       }
//       return {
//         ...media,
//         params: {
//           ...(media.params || {}),
//           loopBounce,
//         },
//       };
//     });
//     return true;
//   }
//   if (action === "reverse") {
//     const reverse = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("reverse on non-video media", media);
//         return media;
//       }
//       return {
//         ...media,
//         params: {
//           ...(media.params || {}),
//           reverse,
//         },
//       };
//     });
//     return true;
//   }
//   if (action === "addEffect") {
//     const effectType = event.payload;
//     const newEffect: Effect = createBlankEffect(effectType);
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("addEffect on non-video media", media);
//         return media;
//       }
//       return {
//         ...media,
//         effects: [...(media.effects || []), newEffect],
//       };
//     });
//     return true;
//   }
//   if (action === "effectOrder") {
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("effectOrder on non-video media", media);
//         return media;
//       }
//       return {
//         ...media,
//         effects: event.payload.map((key: string) => {
//           const effect = media.effects?.find((effect) => effect.key === key);
//           if (!effect) throw new Error("Invalid effect order");
//           return effect;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "addLayer") {
//     const mediaType = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "layers") {
//         console.warn("addLayer on non-layer media", media);
//         return media;
//       }
//       return {
//         ...media,
//         layers: [
//           {
//             key: randomUUID(),
//             media: createBlankScene(mediaType),
//             blendMode: "mix",
//             blendAmount: 0,
//           },
//           ...(media.layers || []),
//         ],
//       };
//     });
//     return true;
//   }
//   if (action === "addToSequence") {
//     const mediaType = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "sequence") {
//         console.warn("addToSequence on non-sequence media", media);
//         return media;
//       }
//       return {
//         ...media,
//         sequence: [
//           ...(media.sequence || []),
//           {
//             key: randomUUID(),
//             media: createBlankScene(mediaType),
//           },
//         ],
//       };
//     });
//     return true;
//   }
//   if (action === "saveGoNextToDash") {
//     const mediaKey = controlPath.join(".");
//     addToDashboard(mediaKey, "goNextButton");
//     return true;
//   }
//   if (action === "addToSequenceFromLibrary") {
//     const libraryKey = event.payload;
//     console.log("adding to sequence", libraryKey);
//     rootSceneUpdate(controlPath, (media) => {
//       return media;
//     });
//   }
//   if (action === "transitionDuration") {
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "sequence") {
//         console.warn("addToSequence on non-sequence media", media);
//         return media;
//       }
//       return {
//         ...media,
//         transition: {
//           type: media.transition?.type || "fade",
//           mode: media.transition?.mode || "mix",
//           duration: event.payload[0],
//         },
//       };
//     });
//     return true;
//   }

//   if (action === "goNext") {
//     console.log("going next", controlPath);
//     goNext(controlPath);
//     return true;
//   }
//   if (action === "blendMode") {
//     const layerKey = controlPath.at(-1);
//     const blendMode = event.payload;
//     const targetPath = controlPath.slice(0, -2);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "layers") {
//         console.warn("blendMode on non-layer media", media);
//         return media;
//       }
//       return {
//         ...media,
//         layers: (media.layers || []).map((layer) => {
//           if (layer.key === layerKey) {
//             return { ...layer, blendMode };
//           }
//           return layer;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "blendAmount") {
//     const layerKey = controlPath.at(-1);
//     const blendAmount = event.payload[0];
//     const targetPath = controlPath.slice(0, -2);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "layers") {
//         console.warn("blendMode on non-layer media", media);
//         return media;
//       }
//       return {
//         ...media,
//         layers: (media.layers || []).map((layer) => {
//           if (layer.key === layerKey) {
//             return { ...layer, blendAmount };
//           }
//           return layer;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "sequenceOrder") {
//     const order = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "sequence") return media;
//       return {
//         ...media,
//         sequence: order.map((key: string) => {
//           const layer = media.sequence?.find((item) => item.key === key);
//           if (!layer) throw new Error("Invalid sequence order");
//           return layer;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "layerOrder") {
//     const order = event.payload;
//     rootSceneUpdate(controlPath, (media) => {
//       if (media.type !== "layers") return media;
//       return {
//         ...media,
//         layers: order.map((key: string) => {
//           const layer = media.layers?.find((layer) => layer.key === key);
//           if (!layer) throw new Error("Invalid layer order");
//           return layer;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "removeLayer") {
//     const targetPath = controlPath.slice(0, -2);
//     const layerKey = event.dataState.action.at(-1);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "layers") return media;
//       return {
//         ...media,
//         layers: (media.layers || []).filter((layer) => layer.key !== layerKey),
//       };
//     });
//     return true;
//   }
//   if (action === "removeItem") {
//     const targetPath = controlPath.slice(0, -2);
//     const itemKey = event.dataState.action.at(-1);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "sequence") return media;
//       return {
//         ...media,
//         sequence: (media.sequence || []).filter((item) => item.key !== itemKey),
//       };
//     });
//     return true;
//   }
//   if (action === "maxDuration") {
//     let duration: null | number = null;
//     if (Array.isArray(event.payload)) duration = event.payload[0]; // slider gives us an array
//     if (event.dataState.action?.[3]) duration = event.dataState.action?.[3]; // hardcoded events
//     if (event.payload === true) duration = 10;
//     if (event.payload === false) duration = null;
//     const targetPath = controlPath.slice(0, -2);
//     const itemKey = controlPath.at(-1);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "sequence") return media;
//       return {
//         ...media,
//         sequence: (media.sequence || []).map((item) => {
//           if (item.key === itemKey) {
//             return { ...item, maxDuration: duration };
//           }
//           return item;
//         }),
//       };
//     });
//     return true;
//   }
//   if (action === "goOnVideoEnd") {
//     const targetPath = controlPath.slice(0, -2);
//     const itemKey = controlPath.at(-1);
//     rootSceneUpdate(targetPath, (media) => {
//       if (media.type !== "sequence") return media;
//       return {
//         ...media,
//         sequence: (media.sequence || []).map((item) => {
//           if (item.key === itemKey) {
//             return { ...item, goOnVideoEnd: event.payload };
//           }
//           return item;
//         }),
//       };
//     });
//     return true;
//   }

//   return false;
// }

// const SliderGrabDelta = 0.01;

// let midiManualTransitionDebounceTimeout: NodeJS.Timeout | undefined = undefined;
// let midiManualTransitionSlowSet: number | undefined = undefined;
// function midiSetManualTransition(value: number) {
//   clearTimeout(midiManualTransitionDebounceTimeout);
//   if (
//     midiManualTransitionSlowSet &&
//     Date.now() - midiManualTransitionSlowSet < 100
//   ) {
//     setManualTransition(value);
//     midiManualTransitionSlowSet = undefined;
//   }
//   midiManualTransitionSlowSet = Date.now();
//   midiManualTransitionDebounceTimeout = setTimeout(() => {
//     setManualTransition(value);
//   }, 100);
// }

// let sliderUpdateTimeout: NodeJS.Timeout | undefined = undefined;
// function slowUpdateSliderValue(field: string, value: number) {
//   clearTimeout(sliderUpdateTimeout);
//   sliderUpdateTimeout = setTimeout(() => {
//     updateSliderValue(field, value);
//   }, 150);
// }
