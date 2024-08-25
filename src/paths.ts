import { join } from 'path';

export const statePath = process.env.DATA_PATH || join(__dirname, './../../Uprising-Data');
console.log('DATA_PATH:', statePath);
export const mainStatePath = join(statePath, 'main.json');
export const libraryPath = join(statePath, 'library');
export const mediaPath = join(statePath, 'media');
export const importingPath = join(statePath, 'importing');
