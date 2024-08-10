import {
  Text,
  YStack,
  Button,
  BottomSheet,
  BottomSheetTriggerButton,
  BottomSheetCloseButton,
} from '@rise-tools/kitchen-sink/server';
import { navigate } from '@rise-tools/kit-react-navigation/server';
import { lookup, query, view, state } from '@rise-tools/server';
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { defaultMainState, MainState, MainStateSchema, Media, VideoMedia } from './state-schema';
import { randomUUID } from 'crypto';
import { mainStatePath, mediaPath } from './paths';
import { join } from 'path';
import { MediaIndex, mediaIndex } from './media';

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

function mainStateUpdate(updater: (state: MainState) => MainState) {
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

function updateMediaState(prevState: Media, path: string[], updater: (media: Media) => Media): Media {
  if (path.length === 0) {
    return updater(prevState);
  }
  throw new Error('lol not implemented');
}

export function updateRootMedia(mediaPath: string, updater: (media: Media) => Media) {
  const path = mediaPath.split(':');
  mainStateUpdate((state) => {
    if (path[0] === 'live') {
      return {
        ...state,
        liveMedia: updateMediaState(state.liveMedia, path.slice(1), updater),
      };
    }
    if (path[0] === 'ready') {
      return {
        ...state,
        readyMedia: updateMediaState(state.readyMedia, path.slice(1), updater),
      };
    }
    return state;
  });
}

init().catch((e) => {
  console.error('Failed to init', e);
});

function drillMediaState(media: Media, path: string[]) {
  if (path.length === 0) return media;
  // todo, handle sub media paths and effects
  return null;
}

function drillRootMediaState(state: MainState | null, path: string[]): Media | null {
  if (!state) return null;
  const [mediaId, ...rest] = path;
  if (mediaId === 'live') return drillMediaState(state.liveMedia, rest);
  if (mediaId === 'ready') return drillMediaState(state.readyMedia, rest);
  return null;
}

export const mediaState = lookup((mediaPath) => {
  return view((get) => {
    const state = get(mainState);
    const path = mediaPath.split(':');
    return drillRootMediaState(state!, path);
  });
});

export function createBlankMedia(type: Media['type']): Media {
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
