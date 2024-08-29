import { query, state } from '@rise-tools/server';
import { readFile, readdir, writeFile, rename } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { importingPath, mediaPath } from './paths';
import { randomUUID } from 'crypto';
import fs from 'fs';
import { execFile } from 'child_process';
import { importMediaFile } from './eg-video-conversion';

const mediaFileSchema = z.object({
  id: z.string(),
  egFramesFile: z.string(),
  sourceUrl: z.string(),
  title: z.string(),
  importerMetadata: z.any(),
  downloadMetadata: z.any(),
});

export type MediaFile = z.infer<typeof mediaFileSchema>;

const mediaIndexSchema = z.object({
  files: z.array(mediaFileSchema),
  deletedFiles: z.array(mediaFileSchema).optional(),
});

export type MediaIndex = z.infer<typeof mediaIndexSchema>;

export const mediaIndex = query(async () => {
  const mediaIndex = join(mediaPath, 'index.json');
  try {
    const indexData = JSON.parse(await readFile(mediaIndex, { encoding: 'utf-8' }));
    const index = mediaIndexSchema.parse(indexData);
    return {
      ...index,
      files: index.files.map((file) => ({
        ...file,
      })),
    };
  } catch (e) {
    console.error('Failed to read media index', e);
    return { files: [] };
  }
});

async function updateMediaIndex(updater: (index: MediaIndex) => MediaIndex) {
  const mediaIndexPath = join(mediaPath, 'index.json');
  const index = await mediaIndex.load();
  const newIndex = updater(index);
  await writeFile(mediaIndexPath, JSON.stringify(newIndex, null, 2));
  mediaIndex.invalidate();
}

export async function renameMediaFile(id: string, newTitle: string) {
  console.log('rename', id, newTitle);
  await updateMediaIndex((index) => {
    return {
      ...index,
      files: index.files.map((file) => {
        if (file.id === id) {
          return { ...file, title: newTitle };
        }
        return file;
      }),
    };
  });
}

export async function deleteMediaFile(id: string) {
  await updateMediaIndex((index) => {
    const file = index.files.find((file) => file.id === id);
    if (!file) return index;
    return {
      ...index,
      files: index.files.filter((file) => file.id !== id),
      deletedFiles: [...(index.deletedFiles || []), file],
    };
  });
}

export async function duplicateFile(id: string) {
  await updateMediaIndex((index) => {
    const file = index.files.find((file) => file.id === id);
    if (!file) return index;
    return {
      ...index,
      files: [
        ...index.files,
        {
          ...file,
          id: randomUUID(),
          title: `${file.title} (copy)`,
        },
      ],
    };
  });
}

export type ImportState = {
  importing: { url: string; id: string; state: string }[];
};

const [_importState, setImportState] = state<ImportState | null>({
  importing: [],
});

export const importState = _importState;

export async function importMedia(url: string) {
  const id = randomUUID();
  setImportState((state) => {
    return { importing: [...(state?.importing || []), { url, id, state: 'initializing' }] };
  });

  if (url.startsWith('DIR:')) {
    console.log('importing dir', url);
    const dirPath = url.slice(4);
    const files = await readdir(dirPath);
    const mp4Files = files.filter((file) => file.endsWith('.mp4'));

    const importResults = await Promise.all(
      mp4Files.map(async (file, idx) => {
        const filePath = join(dirPath, file);
        console.log(`importing file ${idx}/${mp4Files.length}`, filePath);
        const setProgressState = (progressState: string) => {
          setImportState((state) => {
            return {
              importing:
                state?.importing.map((importItem) => {
                  if (importItem.id === id) {
                    return { ...importItem, state: progressState };
                  }
                  return importItem;
                }) || [],
            };
          });
        };

        const importResult = await importMediaFile(filePath, importingPath, setProgressState, idx, mp4Files.length);
        setProgressState('Finalizing');
        await rename(`${importingPath}/${importResult.egFramesFile}`, `${mediaPath}/${id}.eg.data`);

        updateMediaIndex((index) => {
          return {
            ...index,
            files: [
              ...(index?.files || []),
              {
                id,
                sourceUrl: url,
                title: file,
                egFramesFile: `${id}.eg.data`,
                importerMetadata: importResult,
                downloadMetadata: null,
              },
            ],
          };
        });

        return importResult;
      })
    );

    console.log('All files imported:', importResults);
  } else {
    setImportState((state) => {
      return { importing: [...(state?.importing || []), { url, id, state: 'downloading' }] };
    });
    const { info, mediaFile } = await downloadFile(url, id);
    const setProgressState = (progressState: string) => {
      setImportState((state) => {
        return {
          importing:
            state?.importing.map((importItem) => {
              if (importItem.id === id) {
                return { ...importItem, state: progressState };
              }
              return importItem;
            }) || [],
        };
      });
    };
    const importResult = await importMediaFile(`${importingPath}/${mediaFile}`, importingPath, setProgressState);
    setProgressState('Finalizing');
    await rename(`${importingPath}/${importResult.egFramesFile}`, `${mediaPath}/${id}.eg.data`);

    updateMediaIndex((index) => {
      return {
        ...index,
        files: [
          ...(index?.files || []),
          {
            id,
            sourceUrl: url,
            title: info.fulltitle || info.title || url,
            egFramesFile: `${id}.eg.data`,
            importerMetadata: importResult,
            downloadMetadata: info,
          },
        ],
      };
    });
  }
}

fs.mkdirSync(importingPath, { recursive: true });
fs.mkdirSync(mediaPath, { recursive: true });

async function downloadFile(url: string, id: string) {
  await new Promise((resolve, reject) => {
    execFile(
      'yt-dlp',
      ['--write-info-json', '-o', `${importingPath}/${id}.%(ext)s`, url],
      {},
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        }
        resolve(stdout);
      }
    );
  });
  const dir = await readdir(importingPath);
  const mediaFile = dir.find((file) => {
    if (file.includes(id) && !file.includes('.info.json')) {
      return true;
    }
  });
  const infoData = await readFile(`${importingPath}/${id}.info.json`, { encoding: 'utf-8' });
  if (!mediaFile) {
    throw new Error('downloaded file not found');
  }
  const info = JSON.parse(infoData);
  if (!info) {
    throw new Error('info file not found');
  }
  return { info, mediaFile };
}
