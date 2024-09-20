import { lookup, state, view } from '@rise-tools/server';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { mainStatePath } from './paths';
import { Dashboard, defaultMainState, Effect, MainState, MainStateSchema, Scene, SliderFields } from './state-schema';
import { MediaIndex, mediaIndex } from './media';
import { DefaultBounceAmount, DefaultBounceDuration } from './constants';
import { getSequenceActiveItem } from './eg-main';
import { mainVideo } from './eg-video-playback';

export const [mainState, setMainState] = state<MainState | null>(null);

function startScene(scene: Scene): Scene {
  if (scene.type === 'layers') {
    return {
      ...scene,
      layers: scene.layers.map((layer) => ({
        ...layer,
        scene: startScene(layer.scene),
      })),
    };
  }
  if (scene.type === 'sequence') {
    return {
      ...scene,
      transitionEndTime: Date.now(),
      nextActiveKey: undefined,
      transitionStartTime: undefined,
      sequence: scene.sequence.map((item) => ({
        ...item,
        scene: startScene(item.scene),
      })),
    };
  }
  if (scene.type === 'video') {
    const player = mainVideo.getPlayer(scene.id);
    player?.restart();
  }
  return scene;
}

async function init() {
  if (existsSync(mainStatePath)) {
    try {
      const mainStateJson = await readFile(mainStatePath, {
        encoding: 'utf-8',
      });
      const mainStateUnvalidated = JSON.parse(mainStateJson);
      const state = MainStateSchema.safeParse(mainStateUnvalidated);
      if (!state.success) {
        throw new Error('Invalid saved state: ' + state.error.message);
      }
      if (!state.data) {
        throw new Error('Invalid saved state');
      }
      const stateStarted = {
        ...state.data,
        liveScene: startScene(state.data.liveScene),
        readyScene: startScene(state.data.readyScene),
      };
      setMainState(stateStarted);
    } catch (e) {
      console.warn('Could not load main state. Creating new one.');
      console.warn(e);
      setMainState(defaultMainState);
    }
  } else {
    setMainState(defaultMainState);
  }
}

let mainStateToDiskTimeout: undefined | NodeJS.Timeout = undefined;

export function mainStateUpdate(updater: (state: MainState) => MainState) {
  clearTimeout(mainStateToDiskTimeout);
  setMainState((mainState) => {
    if (!mainState) throw new Error('Cannot update main state, it is not inited yet');
    const newMainState = updater(mainState);
    return newMainState;
  });
  mainStateToDiskTimeout = setTimeout(() => {
    writeFile(mainStatePath, JSON.stringify(mainState.get())).catch((e) => {
      console.error('Failed to write main state to disk', e);
    });
  }, 500);
}

function sceneUpdater(prevScene: Scene, path: string[], updater: (scene: Scene) => Scene): Scene {
  if (path.length === 0) {
    return updater(prevScene);
  }
  if (path[0].startsWith('layer_')) {
    const [layerTerm, ...rest] = path;
    const layerKey = layerTerm.slice(6);
    if (prevScene.type !== 'layers') return prevScene;
    // todo, avoid returning a new state object if the layer's scene is actually unchanged
    return {
      ...prevScene,
      layers: prevScene.layers.map((layer) => {
        if (layer.key !== layerKey) return layer;
        return {
          ...layer,
          scene: sceneUpdater(layer.scene, rest, updater),
        };
      }),
    };
  }
  if (path[0].startsWith('item_')) {
    const [itemTerm, ...rest] = path;
    const itemKey = itemTerm.slice(5);
    if (prevScene.type !== 'sequence') return prevScene;
    // todo, avoid returning a new state object if the sequnce item's scene is actually unchanged
    return {
      ...prevScene,
      sequence: prevScene.sequence.map((item) => {
        if (item.key !== itemKey) return item;
        return {
          ...item,
          scene: sceneUpdater(item.scene, rest, updater),
        };
      }),
    };
  }
  return prevScene;
}

export function updateScene(path: string[], updater: (scene: Scene) => Scene) {
  mainStateUpdate((state) => {
    if (path[0] === 'live') {
      const scene = sceneUpdater(state.liveScene, path.slice(1), updater);
      if (scene === state.liveScene) return state;
      return {
        ...state,
        liveScene: scene,
      };
    }
    if (path[0] === 'ready') {
      const scene = sceneUpdater(state.readyScene, path.slice(1), updater);
      if (scene === state.readyScene) return state;
      return {
        ...state,
        readyScene: scene,
      };
    }
    return state;
  });
}

init().catch((e) => {
  console.error('Failed to init', e);
});

function drillSceneState(scene: Scene, path: string[]) {
  if (path.length === 0) return scene;
  if (path[0].startsWith('layer_')) {
    if (scene.type !== 'layers') return null;
    const layerKey = path[0].slice(6);
    const layer = scene.layers.find((layer) => layer.key === layerKey);
    if (!layer) return null;
    return drillSceneState(layer.scene, path.slice(1));
  }
  if (path[0].startsWith('item_')) {
    if (scene.type !== 'sequence') return null;
    const layerKey = path[0].slice(5);
    const layer = scene.sequence.find((item) => item.key === layerKey);
    if (!layer) return null;
    return drillSceneState(layer.scene, path.slice(1));
  }
  return null;
}

function drillMainSceneState(state: MainState | null, path: string[]): Scene | null {
  if (!state) return null;
  const [rootSceneId, ...rest] = path;
  if (rootSceneId === 'live') return drillSceneState(state.liveScene, rest);
  if (rootSceneId === 'ready') return drillSceneState(state.readyScene, rest);
  return null;
}

export const bounceTimes: Record<string, number> = {};

export const sceneState = lookup((controlPath) => {
  return view(
    (get) => {
      const state = get(mainState);
      const path = controlPath.split(':');
      return drillMainSceneState(state!, path);
    },
    { compare: true }
  );
});

export const sliderFields = lookup((key) => {
  return view(
    (get) => {
      if (key === 'live') return get(mainState)?.liveSliderFields;
      if (key === 'ready') return get(mainState)?.readySliderFields;
      return undefined;
    },
    { compare: true }
  );
});

export const dashboards = lookup((key) => {
  return view(
    (get) => {
      const state = get(mainState);
      const media = get(mediaIndex);
      if (!state) return undefined;
      if (key === 'live')
        return getDashboardState(state.liveScene, state.liveSliderFields, state.liveDashboard, 'live', media);
      if (key === 'ready')
        return getDashboardState(state.readyScene, state.readySliderFields, state.readyDashboard, 'ready', media);
      return undefined;
    },
    { compare: true }
  );
});

export function startAutoTransition() {
  mainStateUpdate((state) => ({
    ...state,
    transitionState: {
      ...state.transitionState,
      autoStartTime: Date.now(),
    },
  }));
}

export type DashboardState = {
  items: DashboardStateItem[];
  buttons: DashboardButtonItem[];
  sliders: DashboardSliderItem[];
};
type BaseDashboardItem = {
  key: string;
  label: string;
  dashboardId: 'live' | 'ready';
  scenePath: string[];
  field: string;
  hardwareLabel: string;
  breadcrumbs: { controlPath: string[]; label: string }[];
};
export type DashboardSliderState = {
  value: number;
  onValue: (value: number) => void;
  onRatioValue: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  smoothing: number | undefined;
  bounceAmount: number | undefined;
  bounceDuration: number | undefined;
  fieldPath: string[];
  label: string;
};
export type DashboardButtonItem = BaseDashboardItem & {
  type: 'button';
  slider?: DashboardSliderState;
  buttonLabel: string;
  onPress: () => void;
};
export type DashboardSliderItem = BaseDashboardItem & {
  type: 'slider';
  slider: DashboardSliderState;
};
export type DashboardStateItem = DashboardButtonItem | DashboardSliderItem;

function getSceneTitle(scene: Scene, mediaIndex: MediaIndex | undefined) {
  if (scene.label) return scene.label;
  if (scene.type === 'video') {
    const file = mediaIndex?.files.find((file) => file.id === scene.track);
    if (file && file.title) return file.title;
    return 'Video';
  }
  if (scene.type === 'color') return 'Color';
  if (scene.type === 'layers') return 'Layers';
  if (scene.type === 'sequence') return 'Sequence';
}

function capitalize(label: string) {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function labelField(fieldPath: string[]) {
  const lastPart = fieldPath.at(-1);
  if (!lastPart) return '?';
  return capitalize(lastPart);
}

function getDashboardState(
  scene: Scene,
  sliderFields: SliderFields,
  dashboard: Dashboard,
  dashboardId: 'live' | 'ready',
  mediaIndex: MediaIndex | undefined
): DashboardState {
  const items: DashboardStateItem[] = [];
  const buttons: DashboardButtonItem[] = [];
  const sliders: DashboardSliderItem[] = [];
  function addButton(button: DashboardButtonItem) {
    buttons.push(button);
    items.push(button);
  }
  function addSlider(slider: DashboardSliderItem) {
    sliders.push(slider);
    items.push(slider);
  }
  function getHardwareButtonLabel() {
    if (buttons.length < 4) return `${dashboardId} button ${buttons.length + 1}`;
    return '';
  }
  function getHardwareSliderLabel() {
    if (sliders.length < 4) return `${dashboardId} slider ${sliders.length + 1}`;
    if (sliders.length < 8) return `${dashboardId} knob ${sliders.length + 1}`;
    return '';
  }
  dashboard.forEach((item) => {
    let breadcrumbWalkPath: string[] = [];
    let breadcrumbWalkScene: null | Scene = scene;
    let sceneContext: (Scene | null)[] = [scene];
    const fieldPath = item.field.split(':');
    const afterScenePathIndex = fieldPath.findIndex((fieldTerm, termIndex) => {
      if (fieldTerm.startsWith('layer_')) {
        const layerKey = fieldTerm.slice(6);
        const lastScene = sceneContext.at(-1)!;
        if (lastScene.type !== 'layers') return;
        const layer = lastScene.layers.find((layer) => layer.key === layerKey);
        sceneContext.push(layer?.scene || null);
        return false;
      } else if (fieldTerm.startsWith('item_')) {
        const itemKey = fieldTerm.slice(5);
        const lastScene = sceneContext.at(-1)!;
        if (lastScene.type !== 'sequence') return;
        const item = lastScene.sequence.find((item) => item.key === itemKey);
        sceneContext.push(item?.scene || null);
        return false;
      } else {
        return true;
      }
    });
    const scenePath = fieldPath.slice(0, afterScenePathIndex);
    const breadcrumbField = item.field
      .split(':')
      .map((term) => {
        if (!breadcrumbWalkScene) return null;
        let label = '';
        if (term.startsWith('layer_')) {
          const layerKey = term.slice(6);
          if (breadcrumbWalkScene.type !== 'layers') {
            breadcrumbWalkScene = null;
            return null;
          }
          const layer = breadcrumbWalkScene.layers.find((layer) => layer.key === layerKey);
          if (!layer) {
            breadcrumbWalkScene = null;
            return null;
          }
          breadcrumbWalkScene = layer.scene;
          const sceneTitle = getSceneTitle(layer.scene, mediaIndex);
          if (sceneTitle) {
            label = sceneTitle;
          }
        }
        if (term.startsWith('item_')) {
          const itemKey = term.slice(5);
          if (breadcrumbWalkScene.type !== 'sequence') {
            breadcrumbWalkScene = null;
            return null;
          }
          const item = breadcrumbWalkScene.sequence.find((item) => item.key === itemKey);
          if (!item) {
            breadcrumbWalkScene = null;
            return null;
          }
          breadcrumbWalkScene = item.scene;
          const sceneTitle = getSceneTitle(item.scene, mediaIndex);
          if (sceneTitle) {
            label = sceneTitle;
          }
        }
        if (term.startsWith('effect_')) {
          const effectKey = term.slice(7);
          const effect = getSceneEffects(breadcrumbWalkScene)?.find((effect) => effect.key === effectKey);
          if (!effect) {
            breadcrumbWalkScene = null;
            return null;
          }
          label = capitalize(effect.type);
        }
        if (term === 'effects') {
          label = 'Effects';
        }
        if (!label) return null;
        breadcrumbWalkPath = [...breadcrumbWalkPath, term];
        return {
          controlPath: [dashboardId, ...breadcrumbWalkPath],
          label,
        };
      })
      .filter((i) => !!i);
    const breadcrumbs = [
      {
        controlPath: [dashboardId],
        label: getSceneTitle(scene, mediaIndex) || '?',
      },
      ...breadcrumbField,
    ];
    const sliderScene = sceneContext.at(-1);
    if (!sliderScene) return;
    const slider =
      item.behavior === 'slider' || item.behavior === 'bounce'
        ? getSliderState(
            dashboardId,
            sliderFields,
            fieldPath.slice(afterScenePathIndex),
            scenePath,
            sliderScene,
            sceneContext.at(-2) || undefined
          )
        : undefined;
    const baseDashboardItem = {
      key: item.key,
      field: item.field,
      scenePath,
      breadcrumbs,
      dashboardId,
      label: labelField(fieldPath),
    };
    if (item.behavior === 'bounce') {
      const sliderField = sliderFields[item.field];
      const bounceAmount = sliderField?.bounceAmount ?? DefaultBounceAmount;
      addButton({
        type: 'button',
        ...baseDashboardItem,
        hardwareLabel: getHardwareButtonLabel(),
        label: `Bounce`,
        buttonLabel: `Bounce ${labelField(fieldPath)} ${bounceAmount > 0 ? `+${bounceAmount}` : bounceAmount} (${Math.round((sliderField?.bounceDuration ?? DefaultBounceDuration) / 100) / 10} sec)`,
        onPress: () => {
          bounceField(dashboardId, item.field);
        },
        slider,
      });
    } else if (item.behavior === 'slider' && slider) {
      addSlider({
        type: 'slider',
        ...baseDashboardItem,
        hardwareLabel: getHardwareSliderLabel(),
        slider,
        label: slider.label,
      });
    } else if (item.behavior === 'goNext') {
      addButton({
        type: 'button',
        ...baseDashboardItem,
        hardwareLabel: getHardwareButtonLabel(),
        label: 'Go Next',
        buttonLabel: 'Go',
        onPress: () => {},
      });
    }
  });
  return {
    items,
    buttons,
    sliders,
  };
}

export function goNext(controlPath: string[]) {
  updateScene(controlPath, (scene) => {
    if (scene.type !== 'sequence') {
      console.warn('goNext on non-sequence media');
      return scene;
    }
    if (!scene.sequence.length) return scene;
    const active = getSequenceActiveItem(scene);
    if (!active) {
      console.warn('goNext: active media not identified');
      return scene;
    }
    const activeIndex = scene.sequence.findIndex((item) => item.key === active.key);
    if (activeIndex === -1) {
      console.warn('goNext: active media not found in sequence');
      return scene;
    }
    const nextIndex = (activeIndex + 1) % scene.sequence.length;
    const nextKey = scene.sequence[nextIndex]?.key;
    if (!nextKey) {
      console.warn('goNext: next media not identified');
      return scene;
    }
    const nextScene = scene.sequence[nextIndex].scene;
    if (nextScene) {
      startScene(nextScene);
    }
    let transitionDuration = 0;
    if (scene.transition?.duration) {
      transitionDuration = scene.transition.duration;
    }
    const now = Date.now();
    return {
      ...scene,
      nextActiveKey: nextKey,
      transitionEndTime: now + transitionDuration,
      transitionStartTime: now,
    };
  });
}

function getSliderState(
  dashboardId: 'live' | 'ready',
  sliderFields: SliderFields,
  fieldPath: string[],
  scenePath: string[],
  scene: Scene,
  parentScene: Scene | undefined
): DashboardSliderState | undefined {
  const field = [...scenePath, ...fieldPath].join(':');
  const sliderField = sliderFields[field];
  const baseSlider = {
    label: labelField(fieldPath),
    smoothing: sliderField?.smoothing,
    bounceAmount: sliderField?.bounceAmount,
    bounceDuration: sliderField?.bounceDuration,
    fieldPath,
    step: 0.01,
  } as const;

  function defineSlider(slider: {
    onValue: (value: number) => void;
    value: number;
    min?: number;
    max?: number;
    label?: string;
    step?: number;
  }): DashboardSliderState {
    const min = slider.min ?? 0;
    const max = slider.max ?? 1;
    return {
      ...baseSlider,
      ...slider,
      min,
      max,
      onRatioValue: (v: number) => {
        const value = min + v * (max - min);
        slider.onValue(value);
      },
    };
  }

  function updateSliderScene(updater: (scene: Scene) => Scene) {
    updateScene([dashboardId, ...scenePath], updater);
  }
  if (fieldPath.length === 1 && fieldPath[0] === 'blendAmount') {
    const layerId = scenePath.at(-1)?.slice(6);
    if (parentScene!?.type !== 'layers') return;
    const layer = parentScene.layers.find((layer) => layer.key === layerId);
    if (!layer) return;
    return defineSlider({
      label: `${capitalize(layer.blendMode)} Amount`,
      value: layer.blendAmount,
      onValue: (v) => {
        updateScene([dashboardId, ...scenePath.slice(0, -1)], (scene) => {
          if (scene.type !== 'layers') return scene;
          return {
            ...scene,
            layers: scene.layers.map((layer) => {
              if (layer.key !== layerId) return layer;
              return { ...layer, blendAmount: v };
            }),
          };
        });
      },
    });
  } else if (fieldPath[0] === 'effects') {
    const effectFieldKey = fieldPath[1];
    const effect = getSceneEffects(scene)?.find((effect) => `effect_${effect.key}` === effectFieldKey);
    const effectField = fieldPath[2];
    function updateEffect(updater: (effect: Effect) => Effect) {
      updateSliderScene((scene) => {
        return {
          ...scene,
          effects: getSceneEffects(scene)?.map((effect) => {
            if (`effect_${effect.key}` !== effectFieldKey) return effect;
            return updater(effect);
          }),
        };
      });
    }
    if (!effect) return;
    if (effect.type === 'hueShift') {
      return defineSlider({
        value: effect.value,
        min: -180,
        max: 180,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    } else if (effect.type === 'desaturate' && effectField === 'value') {
      return defineSlider({
        value: effect.value,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    } else if (effect.type === 'colorize' && effectField === 'amount') {
      return defineSlider({
        value: effect.amount,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, amount: v }));
        },
      });
    } else if (effect.type === 'colorize' && effectField === 'saturation') {
      return defineSlider({
        value: effect.saturation,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, saturation: v }));
        },
      });
    } else if (effect.type === 'colorize' && effectField === 'hue') {
      return defineSlider({
        value: effect.hue,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, hue: v }));
        },
        min: -180,
        max: 180,
        step: 1,
      });
    } else if (effect.type === 'colorChannel' && effectField === 'red') {
      return defineSlider({
        value: effect.red,
        min: -1,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, red: v }));
        },
      });
    } else if (effect.type === 'colorChannel' && effectField === 'green') {
      return defineSlider({
        value: effect.green,
        min: -1,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, green: v }));
        },
      });
    } else if (effect.type === 'colorChannel' && effectField === 'blue') {
      return defineSlider({
        value: effect.blue,
        min: -1,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, blue: v }));
        },
      });
    } else if (effect.type === 'darken' && effectField === 'value') {
      return defineSlider({
        value: effect.value,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    } else if (effect.type === 'brighten' && effectField === 'value') {
      return defineSlider({
        value: effect.value,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    } else if (effect.type === 'contrast' && effectField === 'value') {
      return defineSlider({
        value: effect.value,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    } else if (effect.type === 'prism' && effectField === 'offset') {
      return defineSlider({
        value: effect.offset,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, offset: v }));
        },
      });
    } else if (effect.type === 'prism' && effectField === 'slices') {
      return defineSlider({
        value: effect.slices,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, slices: v }));
        },
      });
    } else if (effect.type === 'rotate' && effectField === 'value') {
      return defineSlider({
        value: effect.value,
        onValue: (v) => {
          updateEffect((effect) => ({ ...effect, value: v }));
        },
      });
    }
  }
}

export function getSceneEffects(scene: Scene): Effect[] | undefined {
  if (scene.type === 'video') return scene.effects;
  if (scene.type === 'layers') return scene.effects;
  if (scene.type === 'sequence') return scene.effects;
  return undefined;
}

export function bounceField(rootSceneId: 'live' | 'ready', fieldPath: string) {
  const key = `${rootSceneId}:${fieldPath}`;
  bounceTimes[key] = Date.now();
}

export function createBlankScene(type: Scene['type']): Scene {
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

export function createBlankEffect(type: Effect['type']): Effect {
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
  if (type === 'contrast')
    return {
      key: randomUUID(),
      type: 'contrast',
      value: 0.5,
    };
  if (type === 'prism')
    return {
      key: randomUUID(),
      type: 'prism',
      mirror: false,
      slices: 1,
      offset: 0,
    };
  if (type === 'colorize')
    return {
      key: randomUUID(),
      type: 'colorize',
      amount: 0,
      saturation: 1,
      hue: 180,
    };
  if (type === 'colorChannel')
    return {
      key: randomUUID(),
      type: 'colorChannel',
      red: 0,
      green: 0,
      blue: 0,
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

export async function addBounceToDashboard(scenePath: string[], fieldPath: string[]) {
  mainStateUpdate((state) => {
    const [rootSceneKey, ...innerScenePath] = scenePath;
    const dashboardKey = rootSceneKey === 'live' ? 'liveDashboard' : 'readyDashboard';
    const prevDashboard = state[dashboardKey];
    return {
      ...state,
      [dashboardKey]: [
        ...prevDashboard,
        {
          key: randomUUID(),
          field: [...innerScenePath, ...fieldPath].join(':'),
          behavior: 'bounce',
        },
      ],
    };
  });
}

export async function addSliderToDashboard(scenePath: string[], fieldPath: string[]) {
  mainStateUpdate((state) => {
    const [rootSceneKey, ...innerScenePath] = scenePath;
    const dashboardKey = rootSceneKey === 'live' ? 'liveDashboard' : 'readyDashboard';
    const prevDashboard = state[dashboardKey];
    return {
      ...state,
      [dashboardKey]: [
        ...prevDashboard,
        {
          key: randomUUID(),
          field: [...innerScenePath, ...fieldPath].join(':'),
          behavior: 'slider',
        },
      ],
    };
  });
}

export function editDashboard(dashboardKey: 'live' | 'ready', updater: (dashboard: Dashboard) => Dashboard) {
  const mainStateKey = dashboardKey === 'live' ? 'liveDashboard' : 'readyDashboard';
  mainStateUpdate((state) => {
    return {
      ...state,
      [mainStateKey]: updater(state[mainStateKey]),
    };
  });
}
