import { query } from '@rise-tools/server';
import { libraryPath } from './paths';
import { readdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { Scene, sceneSchema } from './state-schema';

export const libraryIndex = query(async () => {
  const libraryItems = await readdir(libraryPath);
  const library = libraryItems.map((item) => {
    return item.split('.json')[0];
  });
  return library;
});

export async function writeLibraryItem(scene: Scene) {
  const name = scene.label || `${getSceneTitle(scene)} - ${new Date().toLocaleString()}`;

  await writeFile(join(libraryPath, `${name}.json`), JSON.stringify(scene));
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
  const scene = sceneSchema.parse(sceneData);
  return scene;
}
