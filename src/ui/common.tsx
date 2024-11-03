import {
  BottomSheet,
  BottomSheetTriggerButton,
  Button,
  Heading,
  InputField,
  LucideIcon,
  RiseForm,
  ScrollView,
  Section,
  toast,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { createComponentDefinition } from '@rise-tools/react/jsx-runtime';
import { Scene, SliderFields } from '../state-schema';
import { navigate } from '@rise-tools/kit-react-navigation/server';
import { SubmitButton } from '@rise-tools/kitchen-sink/server';
import { writeLibraryItem } from '../library';
import { ref, response } from '@rise-tools/react';
import { MediaIndex } from '../media';

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

export function SceneEffectsButton({ controlPath }: { controlPath: string[] }) {
  return (
    <Button onPress={navigate(`control/${controlPath.join(':')}:effects`)} icon={<LucideIcon icon="Sparkles" />}>
      Effects
    </Button>
  );
}

export type SceneScreenProps<SceneType> = {
  scene: SceneType;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
  extraControls?: JSXElement | null | undefined;
  onGetMediaIndex: () => MediaIndex | undefined;
  sliderFields?: SliderFields;
};

export function GenericSceneSection({
  controlPath,
  scene,
  onScene,
  children,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
  children?: JSXElement;
}) {
  const rootScene = controlPath[0];
  const labelId = `label-${controlPath.join(':')}`;
  return (
    <>
      <Section title="Scene Options">
        <XStack gap="$4">
          <BottomSheet
            trigger={
              <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Tag" />}>
                Rename Scene
              </BottomSheetTriggerButton>
            }
          >
            <YStack flex={1}>
              <RiseForm
                onSubmit={(fields) => {
                  onScene((s) => ({ ...s, label: fields[labelId] }));
                }}
              >
                <InputField label="Scene Name" id={labelId} defaultValue={scene.label} />
                <SubmitButton>Save Label</SubmitButton>
              </RiseForm>
            </YStack>
          </BottomSheet>
          <Button
            chromeless
            icon={<LucideIcon icon="Download" />}
            onPress={async () => {
              await writeLibraryItem(controlPath, scene);
              return response(toast('Saved to Library'));
            }}
          >
            Save to Library
          </Button>
        </XStack>
        {children}
      </Section>
      <Section title="Main Scene Dashboard">
        <XStack>
          <Button
            marginTop="$4"
            icon={<LucideIcon icon="LayoutDashboard" />}
            onPress={navigate(`dashboard/${rootScene}`)}
          >
            {rootScene === 'live' ? 'Live Dashboard' : 'Ready Dashboard'}
          </Button>
        </XStack>
      </Section>
    </>
  );
}

export function ResetSceneButton({
  controlPath,
  scene,
  onScene,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton icon={<LucideIcon icon="UndoDot" />} theme="red">
          Reset Scene
        </BottomSheetTriggerButton>
      }
    >
      {ref('reset_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
}

export function Section({ title, children }: { title?: string; children?: JSXElement }) {
  return (
    <YStack gap="$4" padding="$4">
      {title ? <Heading>{title}</Heading> : null}
      {children}
    </YStack>
  );
}
