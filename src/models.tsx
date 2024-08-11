import { navigate, StackScreen } from '@rise-tools/kit-react-navigation/server';
import {
  AnimatedProgress,
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  DraggableFlatList,
  Label,
  ScrollView,
  Separator,
  SizableText,
  Slider,
  SliderThumb,
  SliderTrack,
  SliderTrackActive,
  Spinner,
  Text,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { response } from '@rise-tools/react';
import { lookup, view } from '@rise-tools/server';
import { MediaIndex, mediaIndex } from './media';
import { createBlankEffect, createBlankScene, mainState, mainStateUpdate, sceneState, updateScene } from './state';
import { Scene, Transition, TransitionState, VideoScene, Effect } from './state-schema';
import { LucideIcon, WebView } from '@rise-tools/kitchen-sink/server';
import { mainVideo } from './eg-video-playback';

export const models = {
  home: view((get) => {
    const state = get(mainState);
    console.log('huh?!', state);
    if (!state) return <Spinner />;
    return (
      <YStack gap="$4" padding="$4">
        <Button onPress={navigate('control/live')}>Live</Button>
        <Button onPress={navigate('control/ready')}>Ready</Button>
        <Button
          onPress={() => {
            mainStateUpdate((state) => ({
              ...state,
              transitionState: {
                ...state.transitionState,
                autoStartTime: Date.now(),
              },
            }));
          }}
          disabled={state.transitionState.manual !== null}
          icon={<LucideIcon icon="PlayCircle" />}
        >
          Start Transition
        </Button>
        <EditTransition
          transition={state.transition}
          onTransition={(update) => mainStateUpdate((state) => ({ ...state, transition: update(state.transition) }))}
        />
        <AutoTransitionProgress transitionState={state.transitionState} transition={state.transition} />
        {/* <YStack width="100%" aspectRatio={1} backgroundColor="red">
        <WebView
          style={{ flex: 1, backgroundColor: 'white', pointerEvents: 'none' }}
          source={{ uri: 'http://localhost:3000/eg-live' }}
        />
      </YStack> */}
        {/* <Text>{JSON.stringify(get(mainState))}</Text> */}
        <Button onPress={navigate('browse_videos')}>Browse scene</Button>
        <Button onPress={navigate('browse_media')}>Browse Library</Button>
      </YStack>
    );
  }),
  browse_videos: view((get) => {
    const media = get(mediaIndex);
    console.log(media);
    return (
      <YStack gap="$4" padding="$4">
        {media?.files?.map((file) => <Button onPress={() => {}}>{file.title}</Button>)}
      </YStack>
    );
  }),
  control: lookup((controlPath) => {
    const path = controlPath.split(':');
    const { scenePath, restPath } = unpackControlPath(path);
    const scene = sceneState.get(scenePath.join(':'));
    console.log({ controlPath, scenePath, restPath });
    if (restPath[0] === 'effects') {
      if (restPath[1]) {
        return () => null;
        // return <EffectScreen />
      }
      return view((get) => {
        return (
          <EffectsScreen
            scene={scene ? get(scene) : null}
            onScene={(updater) => {
              console.log('effects update');
              updateScene(scenePath, updater);
            }}
            controlPath={path}
          />
        );
      });
    }
    if (restPath.length) {
      return () => <Text>Unrecognized Control Path</Text>;
    }
    return view((get) => (
      <SceneScreen
        scene={scene ? get(scene) : null}
        onScene={(updater) => {
          updateScene(scenePath, updater);
        }}
        controlPath={path}
        onGetMediaIndex={() => get(mediaIndex)}
      />
    ));
  }),
};

function unpackControlPath(controlPath: string[]): { scenePath: string[]; restPath: string[] } {
  const scenePath: string[] = [];
  const restPath: string[] = [];
  let isRest = false;
  controlPath.forEach((term) => {
    if (isRest) restPath.push(term);
    if (term === 'live' || term === 'ready') scenePath.push(term);
    if (term.startsWith('layer_')) scenePath.push(term);
    if (term.startsWith('item_')) scenePath.push(term);
    if (term === 'effects') {
      restPath.push(term);
      isRest = true;
    }
  });
  return { scenePath, restPath };
}

function AutoTransitionProgress({
  transitionState,
  transition,
}: {
  transitionState: TransitionState;
  transition: Transition;
}) {
  const now = Date.now();
  const { autoStartTime } = transitionState;
  const { duration } = transition;
  console.log({ autoStartTime, duration });
  const timeRemaining = Math.max(0, autoStartTime ? duration - (now - autoStartTime) : 0);
  const currentProgress = autoStartTime ? Math.min(1, (now - autoStartTime) / duration) : null;
  return (
    <YStack height={10}>
      <AnimatedProgress
        duration={timeRemaining}
        endProgress={autoStartTime ? 1 : 0}
        startProgress={currentProgress}
        size="small"
        opacity={autoStartTime ? 1 : 0}
      />
    </YStack>
  );
}

const newMediaOptions = [
  { key: 'off', label: 'Off' },
  { key: 'color', label: 'Color' },
  { key: 'video', label: 'Video' },
  { key: 'layers', label: 'Layers' },
  { key: 'sequence', label: 'Sequence' },
] as const;

function SceneScreen({
  scene,
  onScene,
  controlPath,
  onGetMediaIndex,
}: {
  scene: Scene | null | undefined;
  onScene: (update: (s: Scene) => Scene) => void;
  controlPath: string[];
  onGetMediaIndex: () => MediaIndex | undefined;
}) {
  let screen = null;
  if (scene?.type === 'video') {
    screen = <VideoScreen scene={scene} onScene={onScene} controlPath={controlPath} index={onGetMediaIndex()} />;
  }
  if (scene?.type === 'sequence') {
    screen = <SequenceScreen scene={scene} onScene={onScene} controlPath={controlPath} />;
  }
  if (!screen) {
    screen = (
      <YStack>
        <SelectDropdown
          value={scene?.type || 'off'}
          options={newMediaOptions}
          onSelect={(key) => {
            onScene(() => createBlankScene(key));
          }}
        />
      </YStack>
    );
  }
  return (
    <>
      <StackScreen title={getScreenTitle(controlPath)} headerBackTitle={' '} />
      {screen}
    </>
  );
}
function getScreenTitle(controlPath: string[]): string {
  const last = controlPath[controlPath.length - 1];
  const restPath = controlPath.slice(0, -1);
  if (last === 'effects') return `Effects: ${getScreenTitle(restPath)}`;
  if (last === 'live') return 'Live';
  if (last === 'ready') return 'Ready';
  return '?';
}

function EffectsScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene?: Scene | null;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  console.log('EffectsScreen', scene);
  if (!scene) return <SizableText>No Scene</SizableText>;
  if (scene.type !== 'video') return <SizableText>Effects only available on video scenes</SizableText>;
  return (
    <YStack>
      <StackScreen title={getScreenTitle(controlPath)} headerBackTitle={' '} />
      <DraggableFlatList
        data={
          scene?.effects?.map((effect) => ({
            label: (
              <Button marginHorizontal="$4" marginVertical="$1" disabled>
                {effect.type}
              </Button>
            ),
            key: effect.key,
            onPress: navigate(`control/${controlPath.join(':')}:effect_${effect.key}`),
          })) || []
        }
        // onItemPress={(key) => {}}
        onReorder={(keyOrder) => {
          onScene((s) => ({ ...s, effects: keyOrder.map((key) => scene.effects?.find((e) => e.key === key)!) }));
        }}
        footer={
          <YStack gap="$4" padding="$4">
            <NewEffectButton controlPath={controlPath} onScene={onScene} />
          </YStack>
        }
      />
    </YStack>
  );
}

const EffectTypes: Readonly<{ label: string; key: Effect['type'] }[]> = [
  { key: 'desaturate', label: 'Desaturate' },
  { key: 'colorize', label: 'Colorize' },
  { key: 'invert', label: 'Invert' },
  { key: 'hueShift', label: 'Hue Shift' },
  { key: 'brighten', label: 'Brighten' },
  { key: 'darken', label: 'Darken' },
  { key: 'rotate', label: 'Rotate' },
] as const;

function NewEffectButton({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <YStack>
          <Separator marginVertical="$4" />
          <BottomSheetTriggerButton icon={<LucideIcon icon="Sparkles" />}>New Effect</BottomSheetTriggerButton>
        </YStack>
      }
    >
      <YStack gap="$3">
        {EffectTypes.map(({ key, label }) => (
          <BottomSheetCloseButton
            onPress={() => {
              console.log('wtf', key);
              onScene((scene) => {
                console.log('hello', key);
                if (scene.type !== 'video') return scene;
                return { ...scene, effects: [...(scene.effects || []), createBlankEffect(key)] };
              });
              return response(navigate(`control/${controlPath.join(':')}:effect_${key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function SequenceScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  return (
    <YStack>
      <EffectsButton controlPath={controlPath} />
      <ResetButton controlPath={controlPath} scene={scene} onScene={onScene} />
    </YStack>
  );
}

function EffectsButton({ controlPath }: { controlPath: string[] }) {
  return (
    <Button onPress={navigate(`control/${controlPath.join(':')}:effects`)} icon={<LucideIcon icon="Sparkles" />}>
      Effects
    </Button>
  );
}

function ResetButton({
  controlPath,
  scene,
  onScene,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <SelectDropdown
      value={scene?.type || 'off'}
      options={newMediaOptions}
      triggerProps={{ theme: 'red', icon: <LucideIcon icon="UndoDot" /> }}
      triggerLabel="Reset Scene"
      onSelect={(key) => {
        onScene(() => createBlankScene(key));
      }}
    />
  );
}

function VideoScreen({
  scene,
  onScene,
  controlPath,
  index,
}: {
  scene: VideoScene;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
  index: MediaIndex | undefined;
}) {
  return (
    <YStack>
      {index?.files ? (
        <SelectDropdown
          emptyLabel="Select a video track"
          value={scene?.track}
          options={index?.files.map((file) => ({ key: file.fileSha256, label: file.title }))}
          onSelect={(key) => {
            onScene(() => ({ ...scene, track: key, label: index.files.find((f) => f.fileSha256 === key)?.title }));
          }}
        />
      ) : null}
      <Button
        onPress={() => {
          const player = mainVideo.getPlayer(scene.id);
          player?.restart();
        }}
      >
        Restart Video
      </Button>
      {/* <Text>{JSON.stringify(scene)}</Text> */}
      {/* <Text>{JSON.stringify(index?.files)}</Text> */}
      <EffectsButton controlPath={controlPath} />
      <ResetButton controlPath={controlPath} scene={scene} onScene={onScene} />
    </YStack>
  );
}

function SelectDropdown<Options extends Readonly<{ label: string; key: string }[]>>({
  value,
  options,
  onSelect,
  triggerLabel,
  triggerProps,
  emptyLabel,
}: {
  value: Options[number]['key'] | null;
  options: Options;
  onSelect: (key: Options[number]['key']) => void;
  triggerLabel?: string;
  triggerProps?: Parameters<typeof BottomSheetTriggerButton>[0];
  emptyLabel?: string;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton {...triggerProps}>
          {triggerLabel || options.find((o) => o.key === value)?.label || emptyLabel}
        </BottomSheetTriggerButton>
      }
    >
      <ScrollView>
        <YStack>
          {options.map((option) => (
            <BottomSheetCloseButton
              onPress={() => {
                onSelect(option.key);
              }}
            >
              {option.label}
            </BottomSheetCloseButton>
          ))}
        </YStack>
      </ScrollView>
    </BottomSheet>
  );
}

function EditTransition({
  transition,
  onTransition,
}: {
  transition: Transition;
  onTransition: (update: (t: Transition) => Transition) => void;
}) {
  return (
    <BottomSheet trigger={<BottomSheetTriggerButton>Edit Transition</BottomSheetTriggerButton>}>
      <YStack>
        <Label>Duration - {Math.round(transition.duration / 100) / 10} sec</Label>
        <Slider
          value={[transition.duration]}
          max={15_000}
          step={10}
          onValueChange={(duration) => {
            onTransition((t) => ({ ...t, duration: duration[0] }));
          }}
        >
          <SliderTrack>
            <SliderTrackActive />
          </SliderTrack>
          <SliderThumb size="$2" index={0} circular />
        </Slider>
      </YStack>
    </BottomSheet>
  );
}
