import { navigate } from '@rise-tools/kit-react-navigation/server';
import {
  BottomSheet,
  BottomSheetTriggerButton,
  Button,
  LucideIcon,
  Section,
  Text,
  XStack,
} from '@rise-tools/kitchen-sink/server';
import {
  GenericSceneSection,
  getScreenTitle,
  NarrowScrollView,
  ResetSceneButton,
  SceneEffectsButton,
  SceneScreenProps,
} from './common';
import { ref } from '@rise-tools/react';
import { LayersScene, Scene } from '../state-schema';

export function LayersScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<LayersScene>) {
  return (
    <NarrowScrollView>
      <Section title="Layers">
        {scene.layers?.map((layer) => {
          const isBaseLayer = layer === scene.layers?.at(-1);
          return (
            <Button
              key={layer.key}
              icon={isBaseLayer ? null : iconOfBlendMode(layer.blendMode)}
              onPress={navigate(`control/${controlPath.join(':')}:layer_${layer.key}`)}
            >
              {getScreenTitle(layer.scene, [...controlPath, `layer_${layer.key}`])}
            </Button>
          );
        })}
        {scene.layers?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            No Layers Yet
          </Text>
        ) : null}
        <XStack gap="$4">
          <NewLayerButton controlPath={controlPath} onScene={onScene} />
          <Button
            chromeless
            onPress={navigate(`reorder_layers/${controlPath.join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Sort Layers
          </Button>
        </XStack>
        <SceneEffectsButton controlPath={controlPath} />
      </Section>

      {extraControls}
      <GenericSceneSection controlPath={controlPath} scene={scene} onScene={onScene}>
        <XStack gap="$4">
          <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
        </XStack>
      </GenericSceneSection>
    </NarrowScrollView>
  );
}

function NewLayerButton({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="PlusCircle" />}>
          New Layer
        </BottomSheetTriggerButton>
      }
    >
      {ref('add_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
}

function iconOfBlendMode(blendMode: 'add' | 'mix' | 'mask') {
  if (blendMode === 'add') return <LucideIcon icon="PlusCircle" />;
  if (blendMode === 'mix') return <LucideIcon icon="Blend" />;
  if (blendMode === 'mask') return <LucideIcon icon="Eclipse" />;
  return <LucideIcon icon="Blend" />;
}
