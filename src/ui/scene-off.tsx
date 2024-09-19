import { XStack, YStack } from '@rise-tools/kitchen-sink/server';
import { GenericSceneSection, NarrowScrollView, ResetSceneButton, SceneScreenProps } from './common';
import { OffScene } from '../state-schema';

export function OffScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<OffScene>) {
  return (
    <NarrowScrollView>
      <YStack gap="$4" padding="$4">
        {extraControls}
        <GenericSceneSection controlPath={controlPath} scene={scene} onScene={onScene}>
          <XStack gap="$4">
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </XStack>
        </GenericSceneSection>
      </YStack>
    </NarrowScrollView>
  );
}
