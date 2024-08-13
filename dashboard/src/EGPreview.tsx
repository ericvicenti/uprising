import { useEffect, useRef, useState } from 'react';
import ReconnectingWebSocket from 'reconnecting-websocket';
import { Text, View } from 'tamagui';
import styles from './preview-style.module.css';

function EGPreview({ url, size }: { url: string; size: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const writeFrame = useRef<(frame: Uint8Array) => void | null>(null);
  useEffect(() => {
    const ws = new ReconnectingWebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.onopen = function () {
      console.log('connected');
    };
    ws.onclose = function () {
      console.log('disconnected');
    };
    ws.onmessage = function (event) {
      const frame = new Uint8Array(event.data);
      writeFrame.current?.(frame);
    };
    return () => {
      ws.close();
    };
  }, [url]);
  useEffect(() => {
    const egStageRadials = 64;
    const egStageStripLength = 378; // ??
    const egStageInnerRadiusRatio = 0.2416; // calculated with virtual stats from EG laptop: 375 strip length, 989 total diameter

    const egStageMap = [];

    for (let angularIndex = 0; angularIndex < egStageRadials; angularIndex++) {
      const angle = (angularIndex / egStageRadials) * Math.PI * 2;
      const maxY = Math.sin(angle);
      const maxX = Math.cos(angle);
      for (let radialIndex = 0; radialIndex < egStageStripLength; radialIndex++) {
        const radialRatio = radialIndex / egStageStripLength;
        const offsetRadialRatio = egStageInnerRadiusRatio + (1 - egStageInnerRadiusRatio) * radialRatio;
        const relativeX = maxX * offsetRadialRatio;
        const relativeY = maxY * offsetRadialRatio;
        const absoluteX = 0.5 + relativeX / 2;
        const absoluteY = 0.5 + relativeY / 2;

        egStageMap.push({
          x: absoluteX,
          y: absoluteY,
          angle: angle + Math.PI / 2,
          // angle: angle - Math.PI,
        });
      }
    }

    const egCanvasMap = egStageMap.map((point) => {
      const x = Math.floor(point.x * size);
      const y = Math.floor(point.y * size);

      const halfLength = (size * 0.012) / 2;

      return {
        x,
        y,
        strokeStartX: x - halfLength * Math.cos(point.angle),
        strokeStartY: y - halfLength * Math.sin(point.angle),
        strokeEndX: x + halfLength * Math.cos(point.angle),
        strokeEndY: y + halfLength * Math.sin(point.angle),
      };
    });
    const ctx = canvas?.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    // @ts-ignore
    writeFrame.current = (frame: Uint8Array) => {
      egCanvasMap.forEach((point, pointIndex) => {
        const startIndex = pointIndex * 3;
        ctx.strokeStyle = `rgb(${frame[startIndex]}, ${frame[startIndex + 1]}, ${frame[startIndex + 2]})`;
        ctx.beginPath();
        ctx.moveTo(point.strokeStartX, point.strokeStartY);
        ctx.lineTo(point.strokeEndX, point.strokeEndY);
        ctx.stroke();
      });
    };
  }, [size]);
  return <canvas ref={canvas} width={size} height={size} className={styles.slightBlur} />;
}

export function AutoSizeEGPreview({ url, label }: { url: string; label?: string }) {
  const [size, setSize] = useState(1024);
  return (
    <View f={1} aspectRatio={1} maxHeight="100vw" maxWidth="100vh" padding="$4">
      <View f={1} bg="black" onLayout={(e: any) => setSize(e.nativeEvent.layout.width)}>
        <EGPreview url={url} size={size} />
        {label && (
          <Text color="white" position="absolute" fontSize="$8">
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}
