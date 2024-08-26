import { query } from '@rise-tools/server';
import { libraryPath } from './paths';
import { readdir, writeFile, readFile, rename } from 'fs/promises';
import { join } from 'path';
import {
  Dashboard,
  dashboardSchema,
  Scene,
  sceneSchema,
  SliderFields,
  sliderFieldSchema,
  sliderFieldsSchema,
} from './state-schema';
import { mainState } from './state';
import { mkdirSync } from 'fs';

const libraryDeletedPath = join(libraryPath, 'deleted');
mkdirSync(libraryDeletedPath, { recursive: true });

export const libraryIndex = query(async () => {
  const libraryItems = await readdir(libraryPath);
  const library = libraryItems
    .map((item) => {
      return item.match(/(.*)\.json/)?.[1];
    })
    .filter((item) => !!item) as string[];
  return library;
});

export async function writeLibraryItem(controlPath: string[], scene: Scene) {
  const state = mainState.get();
  if (!state) throw new Error('Main state not ready');
  let dashboard: undefined | Dashboard = undefined;
  let sliderFields: undefined | SliderFields = undefined;
  if (controlPath.length === 1 && controlPath[0] === 'live') {
    dashboard = state.liveDashboard;
    sliderFields = state.liveSliderFields;
  } else if (controlPath.length === 1 && controlPath[0] === 'ready') {
    dashboard = state.readyDashboard;
    sliderFields = state.readySliderFields;
  }
  const libraryItem = { scene, dashboard, sliderFields };

  const name = scene.label || `${getSceneTitle(scene)} - ${new Date().toLocaleString()}`;

  await writeFile(join(libraryPath, `${name}.json`), JSON.stringify(libraryItem));
  libraryIndex.invalidate();
}

export function getSceneTitle(scene: Scene) {
  if (scene?.label) return scene.label;
  if (scene?.type === 'video') return 'Video';
  if (scene?.type === 'color') return 'Color';
  if (scene?.type === 'layers') return 'Layers';
  if (scene?.type === 'sequence') return 'Sequence';
  return 'Off';
}

export async function getLibraryItem(name: string) {
  const sceneDataJson = await readFile(join(libraryPath, `${name}.json`), { encoding: 'utf-8' });
  const sceneData = JSON.parse(sceneDataJson);
  const scene = sceneSchema.parse(sceneData.scene);
  return {
    scene,
    dashboard: dashboardSchema.parse(sceneData.dashboard),
    sliderFields: sliderFieldsSchema.parse(sceneData.sliderFields),
  };
}

export async function renameLibraryItem(oldName: string, newName: string) {
  await rename(join(libraryPath, `${oldName}.json`), join(libraryPath, `${newName}.json`));
  libraryIndex.invalidate();
}

export async function deleteLibraryItem(name: string) {
  await rename(join(libraryPath, `${name}.json`), join(libraryDeletedPath, `${name}.json`));
  libraryIndex.invalidate();
}
