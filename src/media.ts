import { query } from '@rise-tools/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { mediaPath } from './paths';

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
  const mediaIndex = join(mediaPath, 'index.json');
  const indexData = JSON.parse(await readFile(mediaIndex, { encoding: 'utf-8' }));
  const index = mediaIndexSchema.parse(indexData);
  return {
    ...index,
    files: index.files.map((file) => ({
      ...file,
    })),
  };
});
