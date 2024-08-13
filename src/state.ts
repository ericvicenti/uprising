import { lookup, state, view } from '@rise-tools/server';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { mainStatePath } from './paths';
import { defaultMainState, Effect, MainState, MainStateSchema, Scene } from './state-schema';

const [_mainState, setMainState] = state<MainState | null>(null);

export const mainState = _mainState;

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
      setMainState(state.data);
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
    return updater(mainState);
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
  throw new Error('lol not implemented');
}

export function updateScene(path: string[], updater: (scene: Scene) => Scene) {
  mainStateUpdate((state) => {
    if (path[0] === 'live') {
      return {
        ...state,
        liveScene: sceneUpdater(state.liveScene, path.slice(1), updater),
      };
    }
    if (path[0] === 'ready') {
      return {
        ...state,
        readyScene: sceneUpdater(state.readyScene, path.slice(1), updater),
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
    return layer?.scene || null;
  }
  if (path[0].startsWith('item_')) {
    if (scene.type !== 'sequence') return null;
    const layerKey = path[0].slice(5);
    const layer = scene.sequence.find((item) => item.key === layerKey);
    return layer?.scene || null;
  }
  return null;
}

function drillMainSceneState(state: MainState | null, path: string[]): Scene | null {
  if (!state) return null;
  const [mediaId, ...rest] = path;
  if (mediaId === 'live') return drillSceneState(state.liveScene, rest);
  if (mediaId === 'ready') return drillSceneState(state.readyScene, rest);
  return null;
}

export const sceneState = lookup((controlPath) => {
  return view((get) => {
    const state = get(mainState);
    const path = controlPath.split(':');
    return drillMainSceneState(state!, path);
  });
});

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
