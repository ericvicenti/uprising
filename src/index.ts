import { createWSServer } from '@rise-tools/server';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFile, writeFileSync } from 'fs';
import { join } from 'path';

import { AudioPlayer, playAudio } from './audio-playback';
import { eg as egInfo } from './eg';
import { getEGLiveFrame, getEGReadyFrame, getSequenceActiveItem } from './eg-main';
import { getMidiFields } from './eg-midi-fields';
import { subscribeMidiEvents } from './eg-midi-server';
import { egSacnService } from './eg-sacn';
import { egVideo } from './eg-video-playback';
import { createEGViewServer } from './eg-view-server';
import {
  DashboardItem,
  defaultMainState,
  Effect,
  MainState,
  MainStateSchema,
  Media,
  SliderField,
} from './state-schema';
import {
  getDashboardUI,
  getEffectsUI,
  getEffectUI,
  getLibraryKeyUI,
  getLibraryUI,
  getMediaLayerUI,
  getMediaSequenceUI,
  getMediaTitle,
  getMediaUI,
  getUIRoot,
  UIContext,
} from './ui';
import { models } from './models';
import { mainState, mainStateUpdate } from './state';
import { libraryPath, mainStatePath, controlPath, statePath } from './paths';

// let mainState: MainState = defaultMainState;

// if (!existsSync(statePath)) {
//   mkdirSync(statePath);
// }

// // Load previous state if there's one present
// if (existsSync(mainStatePath)) {
//   try {
//     const mainStateJson = readFileSync(mainStatePath, { encoding: 'utf-8' });
//     const state = MainStateSchema.safeParse(JSON.parse(mainStateJson));
//     if (!state.success) {
//       throw new Error('Invalid saved state: ' + state.error.message);
//     }
//     if (!state.data) {
//       throw new Error('Invalid saved state');
//     }
//     mainState = state.data;
//   } catch (e) {
//     console.warn('Could not load main state. Creating new one.');
//   }
// }

let libraryKeys: string[] = [];
if (existsSync(libraryPath)) {
  libraryKeys = readdirSync(libraryPath).map((file) => file.replace('.json', ''));
} else {
  mkdirSync(libraryPath);
}

setInterval(() => {
  libraryKeys = readdirSync(libraryPath).map((file) => file.replace('.json', ''));
  // updateLibraryUI();
}, 1000);

function updateLibraryKeys(updater: (keys: string[]) => string[]) {
  libraryKeys = updater(libraryKeys);
  // updateLibraryUI();
}
type LibraryItem = {
  media: Media;
  sliders: Record<string, SliderField>;
  dashboard: DashboardItem[];
};

function saveMedia(key: string, item: LibraryItem) {
  const realKey = key.replaceAll('/', '.');
  const newMediaLocation = join(libraryPath, `${realKey}.json`);
  writeFileSync(newMediaLocation, JSON.stringify(item, null, 2), {});
  updateLibraryKeys((keys) => [...keys, realKey]);
}

function readLibraryKey(key: string): LibraryItem | null {
  const newMediaLocation = join(libraryPath, `${key}.json`);
  const mediaJson = readFileSync(newMediaLocation, { encoding: 'utf-8' });
  return JSON.parse(mediaJson);
}

function deleteLibraryKey(key: string) {
  const newMediaLocation = join(libraryPath, `${key}.json`);
  if (existsSync(newMediaLocation)) {
    updateLibraryKeys((keys) => keys.filter((k) => k !== key));
    unlinkSync(newMediaLocation);
    return;
  }
}

const sacn = egSacnService(egInfo);
const liveViewServer = createEGViewServer(3889);
const readyViewServer = createEGViewServer(3888);

const video = egVideo(egInfo, controlPath, {
  // const video = egVideo(egInfo, process.env.EG_MEDIA_PATH || 'eg-media-2', {
  onPlayerUpdate: () => {
    // updateUI();
  },
  onMediaUpdate: (media) => {
    // wsServer.update("videoList", [
    //   { key: "none", label: "None" },
    //   ...media.files.map((m) => ({ key: m.fileSha256, label: m.title })),
    // ]);
  },
  onFrameInfo: (playerId, playback) => {
    // if (
    //   playback &&
    //   playback.playingFrame != null &&
    //   playback.playingFrame % 10 === 0
    // ) {
    //   wsServer.update(`videoFrameInfo/${playerId}`, {
    //     index: playback.playingFrame,
    //     isForward: playback.isForward,
    //   });
    // }
  },
});

const recentGradientValues: Record<string, number> = {};
const bounceTimes: Record<string, number> = {};

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
    video,
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

// wsServer.update("startTime", startTime);

// function updateSceneUI(
//   mediaKey: string,
//   sceneState: Media,
//   uiContext: UIContext,
//   childrenOnly?: boolean
// ) {
//   // console.log('updateSceneUI', mediaKey, childrenOnly, sceneState)
//   if (!childrenOnly)
//     wsServer.update(mediaKey, getMediaUI(mediaKey, sceneState, uiContext));
//   if (sceneState.type === "video") {
//     wsServer.update(
//       `${mediaKey}.effects`,
//       getEffectsUI(mediaKey, sceneState.effects, uiContext)
//     );
//     sceneState.effects?.forEach((effect) => {
//       wsServer.update(
//         `${mediaKey}.effects.${effect.key}`,
//         getEffectUI(`${mediaKey}.effects.${effect.key}`, effect, uiContext)
//       );
//     });
//     return;
//   }
//   if (sceneState.type === "layers") {
//     sceneState.layers?.forEach((layer) => {
//       // console.log('layer UI', layer.key)
//       const layerKey = `${mediaKey}.layer.${layer.key}`;
//       wsServer.update(layerKey, getMediaLayerUI(layerKey, layer, uiContext));
//       updateSceneUI(layerKey, layer.media, uiContext, true);
//     });
//     return;
//   }
//   if (sceneState.type === "sequence") {
//     sceneState.sequence?.forEach((sequenceItem) => {
//       const sequenceItemKey = `${mediaKey}.item.${sequenceItem.key}`;
//       wsServer.update(
//         sequenceItemKey,
//         getMediaSequenceUI(sequenceItemKey, sequenceItem, uiContext)
//       );
//       updateSceneUI(sequenceItemKey, sequenceItem.media, uiContext, true);
//     });
//     return;
//   }
// }

// const uiContext: UIContext = { video, mainState, libraryKeys };

// function updateUI() {
//   uiContext.mainState = mainState;
//   uiContext.libraryKeys = libraryKeys;
//   wsServer.update("mainState", mainState);
//   wsServer.updateRoot(getUIRoot(mainState, uiContext));
//   wsServer.update(
//     "liveDashboard",
//     getDashboardUI(mainState, uiContext, "liveScene")
//   );
//   wsServer.update(
//     "readyDashboard",
//     getDashboardUI(mainState, uiContext, "readyScene")
//   );
//   // wsServer.update('quickEffects', getQuickEffects())
//   // wsServer.update('beatEffects', getBeatEffects(mainState))
//   updateSceneUI("readyScene", mainState.readyScene, uiContext);
//   updateSceneUI("liveScene", mainState.liveScene, uiContext);
// }

// function updateLibraryUI() {
//   wsServer.update(
//     "libraryItems",
//     libraryKeys.map((key) => ({
//       key,
//       label: key,
//     }))
//   );
//   wsServer.update("library", getLibraryUI(libraryKeys));
//   libraryKeys.forEach((key) => {
//     wsServer.update(`library.${key}`, getLibraryKeyUI(key));
//   });
// }

// updateLibraryUI();
// updateUI();

// let mainStateToDiskTimeout: undefined | NodeJS.Timeout = undefined;

// let midiDashboard = getMidiFields(mainState.get());

// function mainStateUpdate(updater: (state: MainState) => MainState) {
//   clearTimeout(mainStateToDiskTimeout);
//   const prevState = mainState;
//   mainState = updater(mainState);
//   updateUI();
//   mainStateToDiskTimeout = setTimeout(() => {
//     writeFile(mainStatePath, JSON.stringify(mainState), () => {});
//   }, 500);
//   mainStateEffect(mainState, prevState);
//   midiDashboard = getMidiFields(mainState);
// }

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

  // init all video players
  matchAllScenes(state, (media) => {
    if (media.type === 'video') {
      const player = video.getPlayer(media.id);
      if (media.params) player.setParams(media.params);
      if (media.track) player.selectVideo(media.track);
      return true;
    }
    return false;
  });

  // handle auto transitioning with maxDuration
  matchAllScenes(state, (media, controlPath) => {
    if (media.type === 'sequence') {
      const activeItem = getSequenceActiveItem(media);
      if (!activeItem || !activeItem.maxDuration) {
        return false;
      }
      const controlPathString = controlPath.join('.');
      clearTimeout(sequenceAutoTransitions[controlPathString]);
      const maxDurationMs = 1_000 * activeItem.maxDuration;
      const timeUntilMaxDuration = media.transitionStartTime
        ? media.transitionStartTime + maxDurationMs - Date.now()
        : maxDurationMs;
      sequenceAutoTransitions[controlPathString] = setTimeout(
        () => {
          // delete sequenceVideoEndTransitions[controlPathString];
          delete sequenceAutoTransitions[controlPathString];
          goNext(controlPath);
        },
        Math.max(1, timeUntilMaxDuration)
      );
      return true;
    }
    return false;
  });
  // handleVideoEndBehavior();

  // handleAudioPlayback(state, prevState);
  prevState = state;
});

// function mainStateEffect(state: MainState, prevState: MainState) {
// }

// const audioPlayers: Record<string, AudioPlayer> = {};

// function handleAudioPlayback(state: MainState, prevState: MainState) {
//   const isFirstEffect = prevState === state;
//   const prevVideoNodes = isFirstEffect
//     ? []
//     : matchActiveMedia(prevState, (media) => media.type === "video");
//   const videoNodes = matchActiveMedia(state, (media) => media.type === "video");
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
//     const player = video.getPlayer(media.id);
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

function handleVideoEndBehavior() {
  const state = mainState.get();
  if (!state) return;
  matchAllScenes(state, (scene, controlPath) => {
    if (scene.type !== 'sequence') return false;
    const controlPathString = controlPath.join('.');
    const activeItem = getSequenceActiveItem(scene);
    if (!activeItem) return false;
    if (activeItem.scene.type !== 'video') return false;
    if (!activeItem.goOnVideoEnd) return false;
    const player = video.getPlayer(activeItem.scene.id);
    if (!player) return false;
    const playingFrame = player.getPlayingFrame();
    const frameCount = player.getFrameCount();
    if (playingFrame === null || frameCount === null) return false;
    const framesRemaining = frameCount - playingFrame;
    const approxTimeRemaining = (1000 * framesRemaining) / mainAnimationFPS;
    clearTimeout(sequenceVideoEndTransitions[controlPathString]);
    sequenceVideoEndTransitions[controlPathString] = setTimeout(
      () => {
        // console.log('video ended. going next.')
        delete sequenceVideoEndTransitions[controlPathString];
        delete sequenceAutoTransitions[controlPathString];
        goNext(controlPath);
      },
      Math.max(1, approxTimeRemaining)
    );
  });
  matchAllScenes(mainState, (scene, controlPath) => {
    if (scene.type !== 'sequence') return false;
    const controlPathString = controlPath.join('.');
    const { transitionEndTime, transition } = scene;
    if (transitionEndTime && transition) {
      // handle video transition ending
      clearTimeout(sequenceTransitionEnds[controlPathString]);
      const now = Date.now();
      const timeRemaining = transitionEndTime - now;
      // const progress = 1 - timeRemaining / transition.duration // actually wedont need this
      sequenceTransitionEnds[controlPathString] = setTimeout(
        () => {
          delete sequenceTransitionEnds[controlPathString];
          rootMediaUpdate(controlPathString.split('.'), (media: Media): Media => {
            if (media.type !== 'sequence') return media;
            const { nextActiveKey } = media;
            if (!nextActiveKey) return media;
            return {
              ...media,
              transitionEndTime: undefined,
              transitionStartTime: undefined,
              activeKey: nextActiveKey,
              nextActiveKey: undefined,
            };
          });
          // goNext(controlPath)
        },
        Math.max(1, timeRemaining)
      );
      // console.log('player', approxTimeRemaining)
      return true;
    }
    return false;
  });
}

// setInterval(() => {
//   handleVideoEndBehavior();
// }, 250);

// mainStateEffect(mainState, mainState);

function fetchMedia(media: Media, path: string[]): [string[], Media][] {
  if (media.type === 'layers') {
    return [[path, media], ...media.layers.flatMap((layer) => fetchMedia(layer.media, [...path, 'layer', layer.key]))];
  }
  if (media.type === 'sequence') {
    return [[path, media], ...media.sequence.flatMap((item) => fetchMedia(item.media, [...path, 'item', item.key]))];
  }
  return [[path, media]];
}

function fetchAllScenes(state: MainState): [string[], Media][] {
  return [...fetchMedia(state.liveScene, ['liveScene']), ...fetchMedia(state.readyScene, ['readyScene'])];
}

function fetchActiveMedia(media: Media, path: string[]): [string[], Media][] {
  if (media.type === 'layers') {
    return [
      [path, media],
      ...media.layers.flatMap((layer) => fetchActiveMedia(layer.media, [...path, 'layer', layer.key])),
    ];
  }
  if (media.type === 'sequence') {
    const active = getSequenceActiveItem(media);
    if (active) {
      return [[path, media], ...fetchActiveMedia(active.media, [...path, 'item', active.key])];
    }
  }
  return [[path, media]];
}

function fetchAllActiveMedia(state: MainState): [string[], Media][] {
  return [...fetchActiveMedia(state.liveScene, ['liveScene']), ...fetchActiveMedia(state.readyScene, ['readyScene'])];
}

function getMediaCrawl(media: Media, path: string[]): Media | undefined {
  if (path.length === 0) return media;
  const [firstKey, ...restPath] = path;
  if (firstKey === 'layer' && media.type === 'layers') {
    const layerKey = restPath[0];
    const layer = media.layers?.find((layer) => layer.key === layerKey);
    if (!layer) return undefined;
    return getMediaCrawl(layer.media, restPath.slice(1));
  }
  if (firstKey === 'item' && media.type === 'sequence') {
    const itemKey = restPath[0];
    const item = media.sequence?.find((item) => item.key === itemKey);
    if (!item) return undefined;
    return getMediaCrawl(item.media, restPath.slice(1));
  }
}
function getMedia(state: MainState, path: string[]): Media | undefined {
  const [firstKey, ...restPath] = path;
  if (firstKey === 'liveScene') return getMediaCrawl(state.liveScene, restPath);
  if (firstKey === 'readyScene') return getMediaCrawl(state.readyScene, restPath);
  return undefined;
}

function matchAllScenes(
  state: MainState,
  filter: (media: Media, controlPath: string[]) => boolean
): [string[], Media][] {
  const allMedia = fetchAllScenes(state);
  return allMedia.filter(([controlPath, media]) => filter(media, controlPath));
}

function matchActiveMedia(
  state: MainState,
  filter: (media: Media, controlPath: string[]) => boolean
): [string[], Media][] {
  const allMedia = fetchAllActiveMedia(state);
  return allMedia.filter(([controlPath, media]) => {
    if (controlPath[0] === 'liveScene') {
      return filter(media, controlPath);
    }
    return false;
  });
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

// function bounceField(key: string) {
//   bounceTimes[key] = Date.now();
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

//   rootMediaUpdate(controlPath, (media): Media => {
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

// function rootMediaUpdate(
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

// function getMediaSliders(
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

// function getMediaDashboard(
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
//     const mediaValue = getMedia(mainState, controlPath);
//     if (!mediaValue) return true;
//     const key = `${getMediaTitle(mediaValue, uiContext)} - ${new Date().toLocaleString()}`;
//     saveMedia(key, {
//       media: mediaValue,
//       sliders: getMediaSliders(mainState, controlPath),
//       dashboard: getMediaDashboard(mainState, controlPath),
//     });
//     return true;
//   }
//   if (action === "metadata") {
//     rootMediaUpdate(controlPath, (media) => ({
//       ...media,
//       label: event.payload.label,
//     }));
//     return true;
//   }
//   if (action === "clear") {
//     rootMediaUpdate(controlPath, () => createBlankMedia("off"));
//     return true;
//   }
//   if (action === "mode") {
//     const mode = event.payload;
//     rootMediaUpdate(controlPath, () => createBlankMedia(mode));
//     return true;
//   }
//   if (action === "color") {
//     const colorField = event.dataState.action?.[3];
//     const number = event.payload[0];
//     if (colorField === "h" || colorField === "s" || colorField === "l") {
//       rootMediaUpdate(controlPath, (media) => ({
//         ...media,
//         [colorField]: number,
//       }));
//       return true;
//     }
//   }
//   if (action === "track") {
//     const track = event.payload;
//     rootMediaUpdate(controlPath, (media) => ({ ...media, track }));
//     return true;
//   }
//   if (action === "restart") {
//     const media = getMedia(mainState, controlPath);
//     if (media?.type === "video") {
//       const player = video.getPlayer(media.id);
//       if (player) {
//         player.restart();
//       }
//     }
//     return true;
//   }
//   if (action === "pause") {
//     rootMediaUpdate(controlPath, (media) => {
//       if (media.type !== "video") {
//         console.warn("pause on non-video media", media);
//         return media;
//       }
//       const { id } = media;
//       const player = video.getPlayer(id);
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
//       if (media.type !== "layers") {
//         console.warn("addLayer on non-layer media", media);
//         return media;
//       }
//       return {
//         ...media,
//         layers: [
//           {
//             key: randomUUID(),
//             media: createBlankMedia(mediaType),
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
//     rootMediaUpdate(controlPath, (media) => {
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
//             media: createBlankMedia(mediaType),
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
//     rootMediaUpdate(controlPath, (media) => {
//       return media;
//     });
//   }
//   if (action === "transitionDuration") {
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(controlPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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
//     rootMediaUpdate(targetPath, (media) => {
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

function goNext(controlPath: string[]) {
  // rootMediaUpdate(controlPath, (media) => {
  //   if (media.type !== "sequence") {
  //     console.warn("goNext on non-sequence media", media);
  //     return media;
  //   }
  //   if (!media.sequence.length) return media;
  //   const active = getSequenceActiveItem(media);
  //   if (!active) {
  //     console.warn("goNext: active media not identified");
  //     return media;
  //   }
  //   const activeIndex = media.sequence.findIndex(
  //     (item) => item.key === active.key
  //   );
  //   if (activeIndex === -1) {
  //     console.warn("goNext: active media not found in sequence");
  //     return media;
  //   }
  //   const nextIndex = (activeIndex + 1) % media.sequence.length;
  //   const nextKey = media.sequence[nextIndex]?.key;
  //   if (!nextKey) {
  //     console.warn("goNext: next media not identified");
  //     return media;
  //   }
  //   let transitionDuration = 0;
  //   if (media.transition?.duration) {
  //     transitionDuration = media.transition.duration;
  //   }
  //   const now = Date.now();
  //   return {
  //     ...media,
  //     nextActiveKey: nextKey,
  //     transitionEndTime: now + transitionDuration,
  //     transitionStartTime: now,
  //   };
  // });
}

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

// const midiLiveButtons = [23, 24, 25, 26];
// const midiReadyButtons = [27, 28, 29, 30];
// const midiLiveSliders = [3, 4, 5, 6, 14, 15, 16, 17];
// const midiReadySliders = [7, 8, 9, 10, 18, 19, 20, 21];

subscribeMidiEvents((event) => {
  // Chanel Number Map
  //                   1️⃣ 2️⃣  3️⃣ 4️⃣  5️⃣ 6️⃣  7️⃣ 8️⃣  🔽
  // 67   program  64  14  15  16  17  18  19  20  21  22 <- Knobs
  // 🅰️   change  🅱️    3   4   5   6   7   8   9  10  11 <- Sliders
  //      - 60 +       23  24  25  26  27  28  29  30  31 <- Buttons
  // Bank         1  2           49 47 48  46 45 44       <- Extra Buttons
  //                             🔁 ⏪ ⏩  ⏹️  ▶️  ⏺️
  const { key } = event;
  if (key === 'bank') return;
  if (key === 'program') return;
  // const { channel, value } = event;
  // if (channel === 67 && value == 1) {
  //   startAutoTransition();
  // }
  // if (channel === 60) {
  //   if (isMidiTouchingManualTransition) {
  //     midiSetManualTransition(value);
  //     return;
  //   }
  //   const currentManualValue = mainState.transitionState?.manual ?? 0;
  //   const offsetFromCurrentState = Math.abs(value - currentManualValue);
  //   if (offsetFromCurrentState < SliderGrabDelta) {
  //     isMidiTouchingManualTransition = true;
  //     midiSetManualTransition(value);
  //   }
  // }
  // const liveButton = midiLiveButtons.indexOf(channel);
  // if (liveButton !== -1) {
  //   const midiConfig = midiDashboard.live.buttons[liveButton];
  //   if (!midiConfig) return;
  //   if (midiConfig.behavior === "bounceButton") bounceField(midiConfig.field);
  //   if (midiConfig.behavior === "goNextButton")
  //     goNext(midiConfig.field.split("."));
  //   return;
  // }

  // const readyButton = midiReadyButtons.indexOf(channel);
  // if (readyButton !== -1) {
  //   const midiConfig = midiDashboard.ready.buttons[readyButton];
  //   if (!midiConfig) return;
  //   if (midiConfig.behavior === "bounceButton") bounceField(midiConfig.field);
  //   return;
  // }
  // const liveSlider = midiLiveSliders.indexOf(channel);
  // if (liveSlider !== -1) {
  //   const midiConfig = midiDashboard.live.sliders[liveSlider];
  //   if (!midiConfig) return;
  //   // apply midiConfig.min and .max to value. value goes from 0-1
  //   const min = midiConfig.min || 0;
  //   const max = midiConfig.max || 1;
  //   const outputValue = (max - min) * value + min;
  //   slowUpdateSliderValue(midiConfig.field, outputValue);
  //   return;
  // }
  // const readySlider = midiReadySliders.indexOf(channel);
  // if (readySlider !== -1) {
  //   const midiConfig = midiDashboard.ready.sliders[readySlider];
  //   if (!midiConfig) return;
  //   const min = midiConfig.min || 0;
  //   const max = midiConfig.max || 1;
  //   const outputValue = (max - min) * value + min;
  //   slowUpdateSliderValue(midiConfig.field, outputValue);
  //   return;
  // }
  console.log('midi event', event);
});

// let sliderUpdateTimeout: NodeJS.Timeout | undefined = undefined;
// function slowUpdateSliderValue(field: string, value: number) {
//   clearTimeout(sliderUpdateTimeout);
//   sliderUpdateTimeout = setTimeout(() => {
//     updateSliderValue(field, value);
//   }, 150);
// }

function createBlankMedia(type: Media['type']): Media {
  if (type === 'off') {
    return { type };
  }
  if (type === 'color') {
    return { type, h: 0, s: 1, l: 1 };
  }
  if (type === 'video') {
    return { type, track: null, id: randomUUID() };
  }
  if (type === 'layers') {
    return { type, layers: [] };
  }
  if (type === 'sequence') {
    return {
      type,
      sequence: [],
      transition: { type: 'fade', duration: 1000, mode: 'mix' },
    };
  }

  return { type: 'off' };
}

function createBlankEffect(type: Effect['type']): Effect {
  if (type === 'hueShift')
    return {
      key: randomUUID(),
      type: 'hueShift',
      value: 0,
    };
  if (type === 'desaturate')
    return {
      key: randomUUID(),
      type: 'desaturate',
      value: 0,
    };
  if (type === 'colorize')
    return {
      key: randomUUID(),
      type: 'colorize',
      amount: 0,
      saturation: 1,
      hue: 180,
    };
  if (type === 'darken')
    return {
      key: randomUUID(),
      type: 'darken',
      value: 0,
    };
  if (type === 'brighten')
    return {
      key: randomUUID(),
      type: 'brighten',
      value: 0,
    };
  if (type === 'rotate') {
    return {
      key: randomUUID(),
      type: 'rotate',
      value: 0,
    };
  }
  // if (type === 'invert')
  return {
    key: randomUUID(),
    type: 'invert',
  };
}
