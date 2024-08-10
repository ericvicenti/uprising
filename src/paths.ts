import { join } from 'path';

export const statePath = process.env.DATA_PATH || join(__dirname, './../data');
export const mainStatePath = join(statePath, 'main.json');
export const libraryPath = join(statePath, 'library');
export const controlPath = join(statePath, 'media');
