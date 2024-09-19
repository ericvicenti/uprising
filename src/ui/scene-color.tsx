import { XStack, YStack } from '@rise-tools/kitchen-sink/server';
import { GenericSceneSection, NarrowScrollView, ResetSceneButton, SceneScreenProps } from './common';
import { GradientSlider } from './gradient';
import { ColorScene } from '../state-schema';

export function ColorScreen({
  scene,
  onScene,
  controlPath,
  extraControls,
  sliderFields,
}: SceneScreenProps<ColorScene>) {
  return (
    <NarrowScrollView>
      <YStack gap="$4" padding="$4">
        <GradientSlider
          label={`Hue`}
          value={scene.h}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['h']}
          max={360}
          step={1}
          onValueChange={(v) => onScene((s) => ({ ...s, h: v }))}
        />
        <GradientSlider
          label={`Saturation`}
          value={scene.s}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['s']}
          onValueChange={(v) => onScene((s) => ({ ...s, s: v }))}
        />
        <GradientSlider
          label={`Brightness`}
          value={scene.l}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['h']}
          onValueChange={(v) => onScene((s) => ({ ...s, l: v }))}
        />

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
