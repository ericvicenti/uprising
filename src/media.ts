import { query } from '@rise-tools/server';
import { controlPath } from './paths';
import { readFile } from 'fs/promises';
import { basename, join } from 'path';
import { z } from 'zod';

// "fileSha256": "ef08b664c8ace9629fff3fb997c0734aa33e92dd7b1081581be1135d3616ef06",
// "width": 1024,
// "height": 1024,
// "durationInSeconds": 3875.456,
// "completeTime": 1708311105163,
// "videoName": "AK warm water.mp4",
// "filePath": "videos/AK warm water.mp4",
// "egFramesFile": "ef08b664c8ace9629fff3fb997c0734aa33e92dd7b1081581be1135d3616ef06.eg.data",
// "audioFile": "ef08b664c8ace9629fff3fb997c0734aa33e92dd7b1081581be1135d3616ef06.mp3",
// "title": "AK warm water",
// "importerVersion": 2

const mediaFileSchema = z.object({
  fileSha256: z.string(),
  width: z.number(),
  height: z.number(),
  durationInSeconds: z.number(),
  completeTime: z.number(),
  videoName: z.string(),
  filePath: z.string(),
  egFramesFile: z.string(),
  audioFile: z.string().or(z.null()),
  title: z.string(),
  importerVersion: z.number(),
});

export type MediaIndex = z.infer<typeof mediaIndexSchema>;

const mediaIndexSchema = z.object({
  files: z.array(mediaFileSchema),
});

export const mediaIndex = query(async () => {
  const mediaIndex = join(controlPath, 'index.json');
  const indexData = JSON.parse(await readFile(mediaIndex, { encoding: 'utf-8' }));
  const index = mediaIndexSchema.parse(indexData);
  return {
    ...index,
    files: index.files.map((file) => ({
      ...file,
    })),
  };
});
