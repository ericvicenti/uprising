import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { readdir, stat } from 'fs-extra';
import { basename, extname } from 'path';
import zlib from 'zlib';
import { execFile } from 'child_process';
import { egStageMap } from './eg';
// import { DBFile, readDb, updateDb } from './eg-video';

const args = process.argv.slice(2);
const sourceDirPath = args[0];
// const outputDir = args[1]

const { join } = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
const { execFileSync } = require('child_process');

const Jimp = require('jimp');

const importerVersion = 2;

// const videoFilePath = join(process.cwd(), 'videos', videoName)
// console.log({ videoFilePath, ffmpegPath, ffprobePath })

function exec(file: string, args: string[], options: any): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.toString());
      }
    });
  });
}

type ImportMetadata = {
  fileSha256: string;
  width: number;
  height: number;
  conversionDuration: number;
  frameCount: number;
  duration: number;
  completeTime: number;
  videoName: string;
  filePath: string;
  egFramesFile: string;
  audioFile: string | null;
  importerVersion: number;
  sourceFileSize: number;
};

type Task = () => Promise<void>;

class FFmpegQueue {
  private queue: Task[] = [];
  private running = false;

  async add(task: Task) {
    this.queue.push(task);
    if (!this.running) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.running = false;
      return;
    }

    this.running = true;
    const task = this.queue.shift();
    if (task) {
      await task();
    }
    this.processQueue();
  }
}

const ffmpegQueue = new FFmpegQueue();

export async function importMediaFile(
  filePath: string,
  workingDirPath: string,
  onProgress: (progress: string) => void
): Promise<ImportMetadata> {
  const videoName = basename(filePath);
  console.log('Importing file:', videoName);

  onProgress('Calculating Checksum');
  const fileSha256 = await calculateChecksum(filePath);
  const audioFileNameRelative = `${fileSha256}.mp3`;
  const audioFilePath = join(workingDirPath, audioFileNameRelative);

  const fileInfo = await stat(filePath);
  let audioFile: string | null;
  const egFramesFile = `${fileSha256}.eg.data`;

  try {
    onProgress('Extracting audio');
    await extractAudioToMP3(filePath, audioFilePath);
    audioFile = audioFileNameRelative;
  } catch (e) {
    console.error('Failed to extract audio for ' + filePath, e);
    audioFile = null;
  }

  onProgress('Gathering Metadata');
  const dimensionsProbeData = await execPromise(ffprobePath, [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0:s=x',
    filePath,
  ]);
  const dimensions = dimensionsProbeData.trim().split('x').map(Number);
  let width = dimensions[0];
  let height = dimensions[1];

  const frameCountProbeData = await execPromise(ffprobePath, [
    '-v',
    'error',
    '-count_frames',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=nb_read_frames',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const frameCount = Number(frameCountProbeData.trim());

  const durationProbeData = await execPromise(ffprobePath, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const durationInSeconds = parseFloat(durationProbeData.trim());

  let squareFilePath = filePath;
  if (width !== height) {
    const newDimension = Math.min(width, height);
    const cropX = (width - newDimension) / 2;
    const cropY = (height - newDimension) / 2;
    squareFilePath = join(workingDirPath, `${fileSha256}.square.mp4`);
    onProgress('Cropping video');
    await execPromise(ffmpegPath, [
      '-i',
      filePath,
      '-vf',
      `crop=${newDimension}:${newDimension}:${cropX}:${cropY}`,
      '-y',
      '-c:a',
      'copy',
      squareFilePath,
    ]);
    width = newDimension;
    height = newDimension;
  }

  function normalizeCoordinate(v: number): number {
    return Math.max(Math.min(Math.round(v * width), width), 0);
  }

  const egStagePixelMap: { x: number; y: number }[] = [];
  egStageMap.forEach((pixel) => {
    egStagePixelMap.push({
      x: normalizeCoordinate(pixel.x),
      y: normalizeCoordinate(pixel.y),
    });
  });

  const format = 'rawvideo';
  const pixelBytes = 3; // RGB
  const frameSize = width * height * pixelBytes;

  let videoBuffer = Buffer.alloc(0); // Buffer to hold frame data

  onProgress('Extracting video');
  const outputDataFile = join(workingDirPath, egFramesFile);

  try {
    unlinkSync(outputDataFile);
  } catch (e) {
    console.warn('Failed to delete existing file', outputDataFile);
  }

  writeFileSync(outputDataFile, Buffer.alloc(0));

  return new Promise<ImportMetadata>((resolve, reject) => {
    ffmpegQueue.add(async () => {
      const ffmpeg = spawn(ffmpegPath, [
        '-i',
        squareFilePath,
        '-f',
        format,
        '-vf',
        `scale=${width}:${height}`,
        '-pix_fmt',
        'rgb24',
        '-',
      ]);

      ffmpeg.stdout.on('data', (chunk: Buffer) => {
        videoBuffer = Buffer.concat([videoBuffer, chunk]);

        while (videoBuffer.length >= frameSize) {
          const frame = videoBuffer.slice(0, frameSize);
          processFrame(frame);
          videoBuffer = videoBuffer.slice(frameSize);
        }
      });

      ffmpeg.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });

      const startTime = Date.now();

      const frameOutputBuffer = new Uint8Array(egStageMap.length * 3);

      const fsWriter = createWriteStream(outputDataFile, {
        encoding: 'binary',
      });

      ffmpeg.on('close', (code: string | number) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg process exited with code ${code}`));
          return;
        }
        const endTime = Date.now();
        const duration = endTime - startTime;
        const conversionDuration = duration / 1000;
        fsWriter.close();
        resolve({
          fileSha256,
          width,
          height,
          conversionDuration,
          frameCount,
          duration: durationInSeconds,
          completeTime: endTime,
          videoName,
          filePath,
          egFramesFile,
          audioFile,
          importerVersion,
          sourceFileSize: fileInfo.size,
        });
      });

      ffmpeg.on('error', (err) => {
        reject(err);
      });

      function appendFile(data: Uint8Array) {
        const buffer = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
        fsWriter.write(buffer);
      }

      function processFrame(frame: Buffer) {
        let pixelStart = 0;
        let outputStart = 0;
        egStagePixelMap.forEach((pixel, index) => {
          pixelStart = pixel.x * pixelBytes + pixel.y * width * pixelBytes;
          outputStart = index * 3;
          frameOutputBuffer[outputStart] = frame[pixelStart]; // r
          frameOutputBuffer[outputStart + 1] = frame[pixelStart + 1]; // g
          frameOutputBuffer[outputStart + 2] = frame[pixelStart + 2]; // b
        });

        appendFile(frameOutputBuffer);
      }
    });
  });
}

function execPromise(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, args, (error: any, stdout: any, stderr: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function calculateChecksum(filePath: string): Promise<string> {
  // console.log('Calculating checksum...');
  return new Promise<string>((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (data) => {
      hash.update(data, 'utf8');
    });
    stream.on('end', () => {
      const checksum = hash.digest('hex');
      // console.log('Checksum:', checksum);
      resolve(checksum);
    });
    stream.on('error', (err) => {
      reject(err);
    });
  });
}

async function readDirRecursive(scanDir: string) {
  let files: string[] = [];
  const items = await readdir(scanDir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = join(scanDir, item.name);
    if (item.isDirectory()) {
      files = files.concat(await readDirRecursive(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function extractAudioToMP3(videoFilePath: string, audioOutputPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // console.log('extracting audio from ' + videoFilePath + ' to ' + audioOutputPath);
    const args = ['-y', '-i', videoFilePath, '-vn', '-acodec', 'libmp3lame', '-ab', '192k', audioOutputPath];
    const ffmpeg = spawn('ffmpeg', args);
    ffmpeg.stdout.on('data', (data) => {
      // console.log(`stdout: ${data}`)
    });
    ffmpeg.stderr.on('data', (data) => {
      // console.error(`stderr: ${data}`)
    });
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        // console.log('Audio extracted and converted to MP3 successfully');
        resolve();
      } else {
        console.error(`Audio extraction exited with code ${code}`);
        reject(new Error(`Audio extraction exited with code ${code}`));
      }
    });
    ffmpeg.on('error', (err) => {
      console.error('Audio extraction: failed to start FFmpeg process');
      reject(err);
    });
  });
}

// async function main(scanPath: string, outputDir: string) {
//   console.log({ sourceDirPath });
//   const scan = await readDirRecursive(scanPath);
//   const extensions = new Set();
//   for (const filePath of scan) {
//     extensions.add(extname(filePath).toLocaleLowerCase());
//   }
//   const videoFilePaths = scan.filter((filePath) => {
//     const isDotFile = basename(filePath).startsWith('.');
//     if (isDotFile) return false;
//     const ext = extname(filePath).toLocaleLowerCase();
//     const isVideo = ext === '.mp4' || ext === '.mov';
//     if (!isVideo) return false;

//     // const fileInfo = statSync(filePath)
//     // // allow files of up to 500MB
//     // return fileInfo.size < 500_000_000
//     return true;
//   });
//   const dbState = await readDb(outputDir);
//   console.log({ scan, extensions, videoFilePaths });
//   for (const videoFilePath of videoFilePaths) {
//     console.log('starting import...', videoFilePath);
//     const prevFile = dbState.files.find((file) => file.filePath === videoFilePath);

//     const dbFile = await importFile(videoFilePath, outputDir, prevFile);
//     console.log('Done with export', { dbFile });
//     await updateDb(outputDir, (state) => {
//       return {
//         ...state,
//         files: [...state.files.filter((f) => f.fileSha256 !== dbFile.fileSha256), dbFile],
//       };
//     });
//   }
// }

// main(sourceDirPath, outputDir)
//   .then(() => {
//     console.log('complete.')
//   })
//   .catch((e) => {
//     console.error('error:', e)
//   })
