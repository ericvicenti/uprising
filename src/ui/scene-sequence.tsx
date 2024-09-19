import {
  BottomSheet,
  BottomSheetTriggerButton,
  Button,
  LucideIcon,
  Text,
  XStack,
} from '@rise-tools/kitchen-sink/server';
import { DefaultTransition, Scene, SequenceItem, SequenceScene } from '../state-schema';
import {
  GenericSceneSection,
  getScreenTitle,
  NarrowScrollView,
  ResetSceneButton,
  SceneEffectsButton,
  SceneScreenProps,
  Section,
} from './common';
import { ref, response } from '@rise-tools/react';
import { navigate } from '@rise-tools/kit-react-navigation/server';
import { goNext } from '../state';
import { EditTransitionForm } from './transition';

export function SequenceScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<SequenceScene>) {
  const activeItemKey = scene.activeKey || scene.sequence[0]?.key;
  const nextItemKey = scene.nextActiveKey;
  function bgColorOfItem(item: SequenceItem) {
    if (item.key === activeItemKey) return '$green4';
    if (item.key === nextItemKey) return '$yellow4';
    return undefined;
  }
  return (
    <NarrowScrollView>
      <Section title="Sequence Order">
        {scene.sequence?.map((item) => (
          <Button
            key={item.key}
            backgroundColor={bgColorOfItem(item)}
            onPress={() => {
              return response(navigate(`control/${controlPath.join(':')}:item_${item.key}`));
            }}
          >
            {getScreenTitle(item.scene, [...controlPath, `item_${item.key}`])}
          </Button>
        ))}
        {scene.sequence?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            Empty Sequence Yet
          </Text>
        ) : null}

        <XStack gap="$4">
          <NewSequenceItem controlPath={controlPath} onScene={onScene} />
          <Button
            chromeless
            onPress={navigate(`reorder_sequence/${controlPath.join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Reorder Sequence
          </Button>
        </XStack>
      </Section>
      <Section title="Sequence Controls">
        <XStack gap="$4">
          <Button
            theme="green"
            icon={<LucideIcon icon="Play" />}
            onPress={() => {
              goNext(controlPath);
            }}
          >
            Play Next
          </Button>
          <SetTransitionButton scene={scene} onScene={onScene} />
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

function NewSequenceItem({
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
          New Sequence Scene
        </BottomSheetTriggerButton>
      }
    >
      {ref('add_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
}

function SetTransitionButton({
  scene,
  onScene,
}: {
  scene: SequenceScene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Presentation" />}>
          Set Transition
        </BottomSheetTriggerButton>
      }
    >
      <EditTransitionForm
        transition={scene.transition ?? DefaultTransition}
        onTransition={(updater) =>
          onScene((s) => {
            if (s.type !== 'sequence') return s;
            return { ...s, transition: updater(s.transition ?? DefaultTransition) };
          })
        }
      />
    </BottomSheet>
  );
}
