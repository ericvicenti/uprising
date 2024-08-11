import { goBack, navigate, StackScreen } from '@rise-tools/kit-react-navigation/server';
import {
  AnimatedProgress,
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  DraggableFlatList,
  Group,
  GroupItem,
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
  View,
  XGroup,
  XGroupItem,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { randomUUID } from 'crypto';
import { response } from '@rise-tools/react';
import { lookup, view } from '@rise-tools/server';
import { MediaIndex, mediaIndex } from './media';
import { createBlankEffect, createBlankScene, mainState, mainStateUpdate, sceneState, updateScene } from './state';
import {
  Scene,
  Transition,
  TransitionState,
  VideoScene,
  Effect,
  BrightenEffect,
  HueShiftEffect,
  DarkenEffect,
  DesaturateEffect,
  RotateEffect,
  ColorizeEffect,
  LayersScene,
  SequenceScene,
  Layer,
  ColorScene,
} from './state-schema';
import { LucideIcon, WebView } from '@rise-tools/kitchen-sink/server';
import { mainVideo } from './eg-video-playback';
import { hslToHex } from './color';

export const models = {
  home: view((get) => {
    const state = get(mainState);
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
    if (restPath[0] === 'effects') {
      if (restPath[1]) {
        const effectId = restPath[1].split('_')[1];
        return view((get) => (
          <EffectScreen
            scene={scene ? get(scene) : null}
            controlPath={path}
            effectId={effectId}
            onScene={(updater) => {
              updateScene(scenePath, updater);
            }}
          />
        ));
      }
      return view((get) => {
        return (
          <EffectsScreen
            scene={scene ? get(scene) : null}
            onScene={(updater) => {
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

const SceneTypes = [
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
  if (scene?.type === 'layers') {
    screen = <LayersScreen scene={scene} onScene={onScene} controlPath={controlPath} />;
  }
  if (scene?.type === 'color') {
    screen = <ColorScreen scene={scene} onScene={onScene} controlPath={controlPath} />;
  }
  if (!screen) {
    screen = (
      <YStack>
        <SelectDropdown
          value={scene?.type || 'off'}
          options={SceneTypes}
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
  if (!scene) return <SizableText>No Scene</SizableText>;
  if (scene.type !== 'video') return <SizableText>Effects only available on video scenes</SizableText>;
  return (
    <YStack flex={1}>
      <StackScreen title={getScreenTitle(controlPath)} headerBackTitle={' '} />
      <DraggableFlatList
        style={{ height: '100%' }}
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
        header={<View height="$2" />}
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
              const newEffect = createBlankEffect(key);
              onScene((scene) => {
                if (scene.type !== 'video') return scene;
                return { ...scene, effects: [...(scene.effects || []), newEffect] };
              });
              return response(navigate(`control/${controlPath.join(':')}:effect_${newEffect.key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function EffectScreen({
  scene,
  onScene,
  controlPath,
  effectId,
}: {
  scene?: Scene | null;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
  effectId: string;
}) {
  if (!scene) return <SizableText>No Scene</SizableText>;
  if (scene.type !== 'video') return <SizableText>Effects only available on video scenes</SizableText>;
  const effect = scene.effects?.find((e) => e.key === effectId);
  let controls = null;
  function onEffect(update: (e: Effect) => Effect) {
    onScene((scene) => {
      if (scene.type !== 'video') return scene;
      return { ...scene, effects: (scene.effects || []).map((e) => (e.key === effectId ? update(e) : e)) };
    });
  }
  if (effect?.type === 'brighten') {
    controls = <EffectBrightenControls effect={effect} onEffect={onEffect} />;
  }
  if (effect?.type === 'darken') {
    controls = <EffectDarkenControls effect={effect} onEffect={onEffect} />;
  }
  if (effect?.type === 'desaturate') {
    controls = <EffectDesaturateControls effect={effect} onEffect={onEffect} />;
  }
  if (effect?.type === 'rotate') {
    controls = <EffectRotateControls effect={effect} onEffect={onEffect} />;
  }
  if (effect?.type === 'hueShift') {
    controls = <EffectHueShiftControls effect={effect} onEffect={onEffect} />;
  }
  if (effect?.type === 'colorize') {
    controls = <EffectColorizeControls effect={effect} onEffect={onEffect} />;
  }
  return (
    <YStack flex={1} padding="$4" gap="$4">
      <StackScreen title={getScreenTitle(controlPath)} headerBackTitle={' '} />
      {controls}
      <Button
        onPress={() => {
          onScene((scene) => {
            if (scene.type !== 'video') return scene;
            return { ...scene, effects: (scene.effects || []).filter((e) => e.key !== effectId) };
          });
          return response(goBack());
        }}
        icon={<LucideIcon icon="Trash" />}
      >
        Remove Effect
      </Button>
    </YStack>
  );
}

function EffectBrightenControls({
  effect,
  onEffect,
}: {
  effect: BrightenEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  return (
    <YStack>
      <EffectSlider
        label="Brightness"
        value={effect.value}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
      />
    </YStack>
  );
}

function EffectDarkenControls({
  effect,
  onEffect,
}: {
  effect: DarkenEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  return (
    <YStack>
      <EffectSlider
        label="Darkness"
        value={effect.value}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
      />
    </YStack>
  );
}

function EffectDesaturateControls({
  effect,
  onEffect,
}: {
  effect: DesaturateEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  return (
    <YStack>
      <EffectSlider
        label="Desaturate"
        value={effect.value}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
      />
    </YStack>
  );
}

function EffectColorizeControls({
  effect,
  onEffect,
}: {
  effect: ColorizeEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  return (
    <YStack>
      <EffectSlider
        label="Amount"
        value={effect.amount}
        onValueChange={(v) => onEffect((e) => ({ ...e, amount: v }))}
      />
      <View height={50} backgroundColor={hslToHex(effect.hue, effect.saturation, 0.5)} borderRadius="$3" />
      <EffectSlider
        label="Hue"
        max={360}
        step={1}
        value={effect.hue}
        onValueChange={(v) => onEffect((e) => ({ ...e, hue: v }))}
      />
      <EffectSlider
        label="Saturation"
        value={effect.saturation}
        onValueChange={(v) => onEffect((e) => ({ ...e, saturation: v }))}
      />
    </YStack>
  );
}

function EffectRotateControls({
  effect,
  onEffect,
}: {
  effect: RotateEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  const onValueChange = (v: number) => onEffect((e) => ({ ...e, value: v }));
  return (
    <YStack>
      <EffectSlider label="Rotation" value={effect.value} onValueChange={onValueChange} />
      <Group separator={<Separator vertical />} orientation="horizontal">
        <GroupItem>
          <Button
            borderRadius={0}
            onPress={() => {
              onValueChange(0);
            }}
          >
            0°
          </Button>
        </GroupItem>
        <GroupItem>
          <Button
            borderRadius={0}
            onPress={() => {
              onValueChange(0.5);
            }}
          >
            180°
          </Button>
        </GroupItem>
      </Group>
    </YStack>
  );
}

function EffectHueShiftControls({
  effect,
  onEffect,
}: {
  effect: HueShiftEffect;
  onEffect: (update: (e: Effect) => Effect) => void;
}) {
  return (
    <YStack>
      <EffectSlider
        label="Hue Shift"
        step={1}
        min={-180}
        max={180}
        value={effect.value}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
      />
    </YStack>
  );
}

function EffectSlider({
  label,
  value,
  onValueChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <>
      <Label>{label}</Label>
      <Slider
        value={[value]}
        min={min == undefined ? 0 : min}
        step={step == undefined ? 0.01 : step}
        max={max == undefined ? 1 : max}
        onValueChange={([v]) => onValueChange(v)}
        height={50}
      >
        <SliderTrack height={50}>
          <SliderTrackActive />
        </SliderTrack>
        {/* <SliderThumb size="$2" index={0} circular /> */}
      </Slider>
    </>
  );
}

function SequenceScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene: SequenceScene;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  return (
    <YStack>
      <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
    </YStack>
  );
}

function ColorScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene: ColorScene;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  return (
    <YStack gap="$4" padding="$4">
      <EffectSlider
        label="Hue"
        value={scene.h}
        onValueChange={(v) => onScene((s) => ({ ...s, h: v }))}
        max={360}
        step={1}
      />
      <EffectSlider label="Saturation" value={scene.s} onValueChange={(v) => onScene((s) => ({ ...s, s: v }))} />
      <EffectSlider label="Brightness" value={scene.l} onValueChange={(v) => onScene((s) => ({ ...s, l: v }))} />
      <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
    </YStack>
  );
}

function LayersScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene: LayersScene;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  return (
    <YStack>
      <DraggableFlatList
        style={{ height: '100%' }}
        data={
          scene?.layers?.map((layer) => ({
            label: (
              <Button marginHorizontal="$4" marginVertical="$1" disabled>
                {layer.key}
              </Button>
            ),
            key: layer.key,
            onPress: navigate(`control/${controlPath.join(':')}:layer_${layer.key}`),
          })) || []
        }
        onReorder={(keyOrder) => {
          onScene((s) => ({ ...s, layers: keyOrder.map((key) => scene.layers?.find((e) => e.key === key)!) }));
        }}
        header={<View height="$2" />}
        footer={
          <YStack gap="$4" padding="$4">
            <NewLayerButton controlPath={controlPath} onScene={onScene} />
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </YStack>
        }
      />
    </YStack>
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
      trigger={
        <YStack>
          <Separator marginVertical="$4" />
          <BottomSheetTriggerButton icon={<LucideIcon icon="PlusCircle" />}>New Layer</BottomSheetTriggerButton>
        </YStack>
      }
    >
      <YStack gap="$3">
        {SceneTypes.map(({ key, label }) => (
          <BottomSheetCloseButton
            onPress={() => {
              const newLayer: Layer = {
                scene: createBlankScene(key),
                key: randomUUID(),
                blendMode: 'mix',
                blendAmount: 0,
              };
              onScene((scene) => {
                console.log('add layer', scene);
                if (scene.type !== 'layers') return scene;
                return { ...scene, layers: [...(scene.layers || []), newLayer] };
              });
              return response(navigate(`control/${controlPath.join(':')}:layer_${newLayer.key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function EffectsButton({ controlPath }: { controlPath: string[] }) {
  return (
    <Button onPress={navigate(`control/${controlPath.join(':')}:effects`)} icon={<LucideIcon icon="Sparkles" />}>
      Effects
    </Button>
  );
}

function ResetSceneButton({
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
      options={SceneTypes}
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
      <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
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
          height={50}
        >
          <SliderTrack height={50}>
            <SliderTrackActive backgroundColor="$color11" />
            {/* <SliderTrackActive width="30%" backgroundColor="$color12" height={1} top={45} bottom={20} /> */}
          </SliderTrack>
          {/* <SliderThumb size="$2" index={0} circular /> */}
        </Slider>
      </YStack>
    </BottomSheet>
  );
}
