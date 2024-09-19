import { ScrollView, YStack } from '@rise-tools/kitchen-sink/server';
import { createComponentDefinition } from '@rise-tools/react/jsx-runtime';
import { Scene } from '../state-schema';

export type JSXElement = ReturnType<ReturnType<typeof createComponentDefinition>>;

export function NarrowScrollView({ children }: { children?: JSXElement }) {
  return (
    <ScrollView contentContainerStyle={{ justifyContent: 'center', flexDirection: 'row' }}>
      <YStack f={1} maxWidth={600}>
        {children}
      </YStack>
    </ScrollView>
  );
}
export function getScreenTitle(scene: Scene | null | undefined, controlPath: string[]): string {
  if (scene?.label) return scene.label;
  if (scene?.type === 'video') return 'Video';
  if (scene?.type === 'color') return 'Color';
  if (scene?.type === 'layers') return 'Layers';
  if (scene?.type === 'sequence') return 'Sequence';
  if (scene?.type === 'off') return 'Off';
  const last = controlPath[controlPath.length - 1];
  const restPath = controlPath.slice(0, -1);
  // if (last === 'effects') return `Effects: ${getScreenTitle(restPath)}`;
  if (last === 'live') return 'Live';
  if (last === 'ready') return 'Ready';
  return '?';
}
