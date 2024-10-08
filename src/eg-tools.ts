import chroma, { mix } from 'chroma-js';

import { EGInfo } from './eg';
import { Frame } from './eg-sacn';

export function applyEGFlash(
  info: EGInfo,
  frame: Uint8Array,
  progress: number, // goes from 0-1
  intensity: number // goes from 0-1
): Uint8Array {
  const { frameSize } = info;
  const effectByteHeight = Math.round((1 - progress) * intensity * 255);
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = Math.min(255, frame[i] + effectByteHeight);
  }
  return outputFrame;
}

export function flashEffect(info: EGInfo) {
  return (frame: Uint8Array, progress: number, intensity: number) => applyEGFlash(info, frame, progress, intensity);
}

export function frameAddStrip(info: EGInfo, frame: Uint8Array, strip: Uint8Array) {
  const { frameSize, egStageRadials, egStageStripLength } = info;
  const outputFrame = new Uint8Array(frameSize);
  let frameI = 0;
  for (let stripIndex = 0; stripIndex < egStageRadials; stripIndex++) {
    for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex++) {
      const startI = frameI;
      outputFrame[startI + 0] = Math.min(255, frame[startI + 0] + strip[pixelIndex * 3 + 0]);
      outputFrame[startI + 1] = Math.min(255, frame[startI + 1] + strip[pixelIndex * 3 + 0]);
      outputFrame[startI + 2] = Math.min(255, frame[startI + 2] + strip[pixelIndex * 3 + 0]);
      frameI += 3;
    }
  }
  return outputFrame;
}

export function waveFrameLayerEffect(info: EGInfo, invertDirection: boolean) {
  const { egStageStripLength } = info;
  return (frame: Uint8Array, progress: number, intensity: number, waveLength: number) => {
    const waveTravel = 1 + waveLength * 2;
    const progressUp = invertDirection ? 1 - progress : progress;
    const effectStrip = new Uint8Array(egStageStripLength * 3);
    for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex++) {
      const pixelPosition = pixelIndex / egStageStripLength;
      const waveProgress = ((progressUp * waveTravel - pixelPosition) * (1 / waveLength)) / 1;
      const waveValue = simpleWave(waveProgress) * intensity * 255;
      effectStrip[pixelIndex * 3 + 0] = Math.round(waveValue);
      effectStrip[pixelIndex * 3 + 1] = Math.round(waveValue);
      effectStrip[pixelIndex * 3 + 2] = Math.round(waveValue);
    }
    return frameAddStrip(info, frame, effectStrip);
  };
}

export function frameMix(info: EGInfo, frameA: Frame, frameB: Frame, mixAmount: number): Frame {
  if (mixAmount > 1) mixAmount = 1;
  if (mixAmount < 0) mixAmount = 0;
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = Math.round(frameA[i] * (1 - mixAmount) + frameB[i] * mixAmount);
  }
  return outputFrame;
}

export function frameAdd(info: EGInfo, frameA: Frame, frameB: Frame, mixAmount: number = 1) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = Math.min(255, frameA[i] + Math.round(frameB[i] * mixAmount));
  }
  return outputFrame;
}

export function frameMask(info: EGInfo, frameA: Frame, frameB: Frame, mixAmount: number): Frame {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  let multi = 0;
  for (let i = 0; i < frameSize; i++) {
    multi = (frameB[i] / 255) * (frameA[i] / 255) * 255;
    outputFrame[i] = Math.round(frameA[i] * (1 - mixAmount) + multi * mixAmount);
    // outputFrame[i] = Math.round(frameA[i] * (1 - mixAmount) + frameB[i] * mixAmount)
  }
  return outputFrame;
}

export function frameInvert(info: EGInfo, frame: Frame) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = 255 - frame[i];
  }
  return outputFrame;
}

export function frameDesaturate(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);

  for (let i = 0; i < frameSize; i += 3) {
    // Calculate the average of the RGB values to get the gray scale (desaturated) color
    const desaturatedColor = (frame[i] + frame[i + 1] + frame[i + 2]) / 3;

    // Calculate new color values based on amount
    outputFrame[i] = clampColor(adjustChannel(frame[i], desaturatedColor, amount));
    outputFrame[i + 1] = clampColor(adjustChannel(frame[i + 1], desaturatedColor, amount));
    outputFrame[i + 2] = clampColor(adjustChannel(frame[i + 2], desaturatedColor, amount));
  }
  return outputFrame;
}

export function frameContrast(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);

  // Calculate the contrast factor using a smooth transition curve centered at amount = 0.5
  const contrast = (amount - 0.5) * 2; // Scale -1 to 1 where 0.5 is no change
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = clampColor(factor * (frame[i] - 128) + 128);
  }

  return outputFrame;
}

export function framePrism(info: EGInfo, frame: Frame, slices: number, offset: number, mirror: boolean) {
  const { frameSize, egStageRadials, egStageStripLength } = info;
  const outputFrame = new Uint8Array(frameSize);
  const offsetStripStart = Math.floor(egStageRadials * offset);
  for (let stripIndex = 0; stripIndex < egStageRadials; stripIndex++) {
    const sliceWidth = Math.round(egStageRadials / slices);
    let baseStripIndex = stripIndex % sliceWidth;
    if (mirror && baseStripIndex >= sliceWidth / 2) {
      baseStripIndex = sliceWidth - baseStripIndex;
    }
    const sourceStripIndex = (baseStripIndex + offsetStripStart) % egStageRadials;
    for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex++) {
      const destByteIndex = (stripIndex * egStageStripLength + pixelIndex) * 3;
      const sourceByteIndex = (sourceStripIndex * egStageStripLength + pixelIndex) * 3;
      outputFrame[destByteIndex + 0] = frame[sourceByteIndex + 0];
      outputFrame[destByteIndex + 1] = frame[sourceByteIndex + 1];
      outputFrame[destByteIndex + 2] = frame[sourceByteIndex + 2];
    }
  }
  return outputFrame;
}

function adjustChannel(original: number, gray: number, amount: number) {
  if (amount > 0) {
    // Reduce saturation by blending the channel towards gray
    return original + (gray - original) * amount;
  } else {
    // Increase saturation by amplifying the difference from gray
    return original + (original - gray) * -amount;
  }
}

function clampColor(value: number) {
  // Clamp the color value to ensure it stays within the 0-255 range
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hue2rgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

export function frameColorize(
  info: EGInfo,
  frame: Frame,
  amount: number,
  targetHueDegrees: number,
  targetSaturationLevel: number
) {
  const { frameSize } = info;
  // const color = chroma.hsl(hue, saturation, 0.5)
  // const colorR = color.get('rgb.r')
  // const colorG = color.get('rgb.g')
  // const colorB = color.get('rgb.b')

  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i += 3) {
    // const desaturatedColor = (frame[i] + frame[i + 1] + frame[i + 2]) / 3
    // outputFrame[i] = frame[i]
    // outputFrame[i + 1] = frame[i + 1]
    // outputFrame[i + 2] = frame[i + 2]

    const redComponent = frame[i] / 255;
    const greenComponent = frame[i + 1] / 255;
    const blueComponent = frame[i + 2] / 255;
    const maxComponentValue = Math.max(redComponent, greenComponent, blueComponent);
    const minComponentValue = Math.min(redComponent, greenComponent, blueComponent);
    let hue: number = 0; // Initialized to 0 to ensure it's always set
    let saturation: number;
    const lightness = (maxComponentValue + minComponentValue) / 2;

    if (maxComponentValue === minComponentValue) {
      hue = saturation = 0; // achromatic, no color
    } else {
      const delta = maxComponentValue - minComponentValue;
      saturation =
        lightness > 0.5
          ? delta / (2 - maxComponentValue - minComponentValue)
          : delta / (maxComponentValue + minComponentValue);

      switch (maxComponentValue) {
        case redComponent:
          hue = (greenComponent - blueComponent) / delta + (greenComponent < blueComponent ? 6 : 0);
          break;
        case greenComponent:
          hue = (blueComponent - redComponent) / delta + 2;
          break;
        case blueComponent:
          hue = (redComponent - greenComponent) / delta + 4;
          break;
      }

      hue /= 6;
    }

    // Convert the HSL values, adjusting hue and saturation to the target values while preserving lightness
    hue = targetHueDegrees / 360;
    saturation = targetSaturationLevel;

    // HSL to RGB conversion
    let adjustedR, adjustedG, adjustedB;
    if (saturation === 0) {
      adjustedR = adjustedG = adjustedB = lightness; // achromatic
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
      const p = 2 * lightness - q;
      adjustedR = hue2rgb(p, q, hue + 1 / 3) * 255;
      adjustedG = hue2rgb(p, q, hue) * 255;
      adjustedB = hue2rgb(p, q, hue - 1 / 3) * 255;
    }

    const outR = Math.round(adjustedR * amount + frame[i] * (1 - amount));
    const outG = Math.round(adjustedG * amount + frame[i + 1] * (1 - amount));
    const outB = Math.round(adjustedB * amount + frame[i + 2] * (1 - amount));

    outputFrame[i] = outR;
    outputFrame[i + 1] = outG;
    outputFrame[i + 2] = outB;
  }
  return outputFrame;
}

export function frameHueShift(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i += 3) {
    const normalizedRed = frame[i] / 255;
    const normalizedGreen = frame[i + 1] / 255;
    const normalizedBlue = frame[i + 2] / 255;
    const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
    const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
    const luminance = (max + min) / 2;
    let saturation = 0;
    let hue = 0;
    if (luminance !== 0 && luminance !== 1) {
      saturation = (max - min) / (1 - Math.abs(2 * luminance - 1));
    }
    if (max !== min) {
      if (max === normalizedRed) {
        hue = 60 * (((normalizedGreen - normalizedBlue) / (max - min)) % 6);
      } else if (max === normalizedGreen) {
        hue = 60 * ((normalizedBlue - normalizedRed) / (max - min) + 2);
      } else {
        hue = 60 * ((normalizedRed - normalizedGreen) / (max - min) + 4);
      }
    }
    let newHue = hue + amount;
    if (newHue < 0) {
      newHue += 360;
    } else if (newHue >= 360) {
      newHue -= 360;
    }
    const chroma = (1 - Math.abs(2 * luminance - 1)) * saturation;
    const intermediateValue = chroma * (1 - Math.abs(((newHue / 60) % 2) - 1));
    let newRed = 0;
    let newGreen = 0;
    let newBlue = 0;
    if (newHue < 60) {
      newRed = chroma;
      newGreen = intermediateValue;
    } else if (newHue < 120) {
      newRed = intermediateValue;
      newGreen = chroma;
    } else if (newHue < 180) {
      newGreen = chroma;
      newBlue = intermediateValue;
    } else if (newHue < 240) {
      newGreen = intermediateValue;
      newBlue = chroma;
    } else if (newHue < 300) {
      newRed = intermediateValue;
      newBlue = chroma;
    } else {
      newRed = chroma;
      newBlue = intermediateValue;
    }
    const luminanceMinusChroma = luminance - chroma / 2;
    newRed = Math.round((newRed + luminanceMinusChroma) * 255);
    newGreen = Math.round((newGreen + luminanceMinusChroma) * 255);
    newBlue = Math.round((newBlue + luminanceMinusChroma) * 255);
    outputFrame[i] = newRed;
    outputFrame[i + 1] = newGreen;
    outputFrame[i + 2] = newBlue;
  }
  return outputFrame;
}

export function frameRotate(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const stripRotateCount = Math.round(amount * info.egStageRadials) % info.egStageRadials;
  if (stripRotateCount === 0) return frame;
  const byteRotate = stripRotateCount * info.egStageStripLength * 3;
  const outputFrame = new Uint8Array(frameSize);
  outputFrame.set(frame.subarray(byteRotate));
  outputFrame.set(frame.subarray(0, byteRotate), frameSize - byteRotate);
  return outputFrame;
}

export function frameBrighten(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = Math.round(Math.min(255, frame[i] * (1 + amount)));
  }
  return outputFrame;
}

export function frameDarken(info: EGInfo, frame: Frame, amount: number) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i++) {
    outputFrame[i] = Math.round(Math.max(0, frame[i] - amount * 255));
  }
  return outputFrame;
}

export function frameColorChannels(
  info: EGInfo,
  frame: Frame,
  amountRed: number,
  amountGreen: number,
  amountBlue: number
) {
  const { frameSize } = info;
  const outputFrame = new Uint8Array(frameSize);
  for (let i = 0; i < frameSize; i += 3) {
    outputFrame[i] = clampColor(frame[i] * (1 + amountRed));
    outputFrame[i + 1] = clampColor(frame[i + 1] * (1 + amountGreen));
    outputFrame[i + 2] = clampColor(frame[i + 2] * (1 + amountBlue));
  }
  return outputFrame;
}

function simpleWave(progress: number) {
  // output a wave from 0-1 as input goes from 0-1
  const usableProgress = Math.min(1, Math.max(0, progress));
  return 1 - (0.5 + Math.cos(Math.PI * 2 * usableProgress) / 2);
}

export function createSolidHSLFrame(info: EGInfo, hue: number, saturation: number, lightness: number) {
  const color = chroma.hsl(hue, saturation, lightness);
  return createSolidRGBFrame(info, color.get('rgb.r'), color.get('rgb.g'), color.get('rgb.b'));
}
export function createSolidRGBFrame(info: EGInfo, redByte: number, greenByte: number, blueByte: number) {
  const { frameSize, egStageRadials, egStageStripLength } = info;
  const frame = new Uint8Array(3 * egStageStripLength * egStageRadials);
  for (let stripIndex = 0; stripIndex < egStageRadials; stripIndex += 1) {
    for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex += 1) {
      const startByte = (stripIndex * egStageStripLength + pixelIndex) * 3;
      frame[startByte] = redByte;
      frame[startByte + 1] = greenByte;
      frame[startByte + 2] = blueByte;
    }
  }
  return frame;
}

export function createRepeatedStripFrame(info: EGInfo, stripValues: Uint8Array) {
  const { egStageStripLength, egStageRadials } = info;
  const frame = new Uint8Array(3 * egStageStripLength * egStageRadials);
  for (let stripIndex = 0; stripIndex < egStageRadials; stripIndex += 1) {
    for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex += 1) {
      const startByte = (stripIndex * egStageStripLength + pixelIndex) * 3;
      frame[startByte] = stripValues[pixelIndex * 3];
      frame[startByte + 1] = stripValues[pixelIndex * 3 + 1];
      frame[startByte + 2] = stripValues[pixelIndex * 3 + 2];
    }
  }
  return frame;
}

export function createRainbowFrame(info: EGInfo, progress: number) {
  const { egStageStripLength } = info;
  // input progress is a ratio from 0-1
  const stripFrame = new Uint8Array(3 * egStageStripLength);
  // for each pixel in the strip, use a different hue. the first pixel hue is basically progress*360
  for (let pixelIndex = 0; pixelIndex < egStageStripLength; pixelIndex += 1) {
    const hue = (progress + pixelIndex / egStageStripLength) % 1;
    const color = chroma.hsl(hue * 360, 1, 0.5);
    stripFrame[pixelIndex * 3] = color.get('rgb.r');
    stripFrame[pixelIndex * 3 + 1] = color.get('rgb.g');
    stripFrame[pixelIndex * 3 + 2] = color.get('rgb.b');
  }
  return createRepeatedStripFrame(info, stripFrame);
}
