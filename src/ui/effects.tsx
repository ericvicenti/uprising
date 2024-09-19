import { navigate, StackScreen } from '@rise-tools/kit-react-navigation/server';
import { getScreenTitle, NarrowScrollView } from './common';
import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  Group,
  GroupItem,
  LucideIcon,
  Section,
  Separator,
  SizableText,
  Text,
  View,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import {
  BrightenEffect,
  ColorChannelEffect,
  ColorizeEffect,
  ContrastEffect,
  DarkenEffect,
  DesaturateEffect,
  Effect,
  HueShiftEffect,
  PrismEffect,
  RotateEffect,
  Scene,
  SliderFields,
} from '../state-schema';
import { GradientSlider } from './gradient';
import { hslToHex } from '../color';
import { SwitchField } from './fields';
import { ButtonGroup } from './button-group';
import { createBlankEffect, getSceneEffects } from '../state';
import { response } from '@rise-tools/react';

const EffectTypes: Readonly<{ label: string; key: Effect['type'] }[]> = [
  { key: 'desaturate', label: 'Desaturate' },
  { key: 'colorize', label: 'Colorize' },
  { key: 'colorChannel', label: 'Color Channels' },
  { key: 'invert', label: 'Invert' },
  { key: 'hueShift', label: 'Hue Shift' },
  { key: 'brighten', label: 'Brighten' },
  { key: 'prism', label: 'Prism' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'darken', label: 'Darken' },
  { key: 'rotate', label: 'Rotate' },
] as const;

export function GlobalEffectsScreen({
  effects,
  onEffects,
}: {
  effects?: Effect[];
  onEffects: (update: (m?: Effect[]) => Effect[]) => void;
}) {
  return (
    <NarrowScrollView>
      <StackScreen title={`Global Fx`} headerBackTitle={' '} />
      {effects?.map((effect) => (
        <Button
          key={effect.key}
          onPress={navigate(`global_effects/${effect.key}`)}
          marginHorizontal="$4"
          marginVertical="$1"
          disabled
        >
          {effect.type}
        </Button>
      ))}
      <YStack gap="$4" padding="$4">
        <NewEffectButton getFollowupPath={(key) => `global_effects/${key}`} onEffects={onEffects} />
      </YStack>
    </NarrowScrollView>
  );
}

function NewEffectButton({
  getFollowupPath,
  onEffects,
}: {
  getFollowupPath: (key: string) => string;
  onEffects: (update: (m?: Effect[]) => Effect[]) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Sparkles" />}>
          Add Effect
        </BottomSheetTriggerButton>
      }
    >
      <Section title="Add Effect">
        <ButtonGroup
          Button={BottomSheetCloseButton}
          items={EffectTypes.map(({ key, label }) => ({
            key,
            label,
            onPress: () => {
              const newEffect = createBlankEffect(key);
              onEffects((effects) => {
                return [...(effects || []), newEffect];
              });
              return response(navigate(getFollowupPath(newEffect.key)));
            },
          }))}
        />
      </Section>
    </BottomSheet>
  );
}

export function EffectScreen({
  controlPath,
  sliderFields,
  effect,
  onEffect,
  onRemove,
}: {
  controlPath?: string[];
  sliderFields?: SliderFields;
  effect: Effect;
  onEffect: (update: (e: Effect) => Effect) => void;
  onRemove: () => void;
}) {
  const effectProps = {
    onEffect,
    sliderFields,
    scenePath: controlPath?.slice(0, -2),
  };
  let controls = null;
  if (effect?.type === 'brighten') {
    controls = <EffectBrightenControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'contrast') {
    controls = <EffectContrastControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'prism') {
    controls = <EffectPrismControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'darken') {
    controls = <EffectDarkenControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'desaturate') {
    controls = <EffectDesaturateControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'rotate') {
    controls = <EffectRotateControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'hueShift') {
    controls = <EffectHueShiftControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'colorize') {
    controls = <EffectColorizeControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'colorChannel') {
    controls = <EffectColorChannelControls effect={effect} {...effectProps} />;
  }
  return (
    <NarrowScrollView>
      <YStack flex={1} padding="$4" gap="$4">
        {controls}
        <XStack gap="$4">
          <Button theme="red" marginTop="$5" onPress={onRemove} icon={<LucideIcon icon="Trash" />}>
            Remove Effect
          </Button>
        </XStack>
      </YStack>
    </NarrowScrollView>
  );
}

type EffectControlsProps<EffectType> = {
  effect: EffectType;
  onEffect: (update: (e: Effect) => Effect) => void;
  sliderFields?: SliderFields;
  scenePath?: string[];
};

function EffectBrightenControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<BrightenEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Brighten Amount"
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectContrastControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<ContrastEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Contrast Amount"
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectPrismControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<PrismEffect>) {
  return (
    <YStack gap="$2">
      <GradientSlider
        label="Slice Count"
        value={effect.slices}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'slices']}
        step={1}
        min={1}
        max={16}
        onValueChange={(v) => onEffect((e) => ({ ...e, slices: v }))}
        sliderFields={sliderFields}
      />
      <SwitchField label="Mirror" value={effect.mirror} onValueChange={(v) => onEffect((e) => ({ ...e, mirror: v }))} />
      <GradientSlider
        label="Offset Input Slice"
        value={effect.offset}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'offset']}
        onValueChange={(v) => onEffect((e) => ({ ...e, offset: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectDarkenControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<DarkenEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Darken Amount"
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectDesaturateControls({
  effect,
  onEffect,
  sliderFields,
  scenePath,
}: EffectControlsProps<DesaturateEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Desaturate Amount"
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectColorizeControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<ColorizeEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Colorize Amount"
        value={effect.amount}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'amount']}
        onValueChange={(v) => onEffect((e) => ({ ...e, amount: v }))}
        sliderFields={sliderFields}
      />
      <View
        height={50}
        marginTop="$4"
        backgroundColor={hslToHex(effect.hue, effect.saturation, 0.5)}
        borderRadius="$3"
      />
      <GradientSlider
        label="Hue"
        max={360}
        step={1}
        value={effect.hue}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'hue']}
        onValueChange={(v) => onEffect((e) => ({ ...e, hue: v }))}
        sliderFields={sliderFields}
      />

      <GradientSlider
        label="Saturation"
        value={effect.saturation}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'saturation']}
        onValueChange={(v) => onEffect((e) => ({ ...e, saturation: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectColorChannelControls({
  effect,
  onEffect,
  sliderFields,
  scenePath,
}: EffectControlsProps<ColorChannelEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Red Channel Adjust"
        value={effect.red}
        scenePath={scenePath}
        min={-1}
        fieldPath={['effects', `effect_${effect.key}`, 'red']}
        onValueChange={(v) => onEffect((e) => ({ ...e, red: v }))}
        sliderFields={sliderFields}
      />
      <GradientSlider
        label="Green Channel Adjust"
        value={effect.green}
        scenePath={scenePath}
        min={-1}
        fieldPath={['effects', `effect_${effect.key}`, 'green']}
        onValueChange={(v) => onEffect((e) => ({ ...e, green: v }))}
        sliderFields={sliderFields}
      />
      <GradientSlider
        label="Blue Channel Adjust"
        value={effect.blue}
        scenePath={scenePath}
        min={-1}
        fieldPath={['effects', `effect_${effect.key}`, 'blue']}
        onValueChange={(v) => onEffect((e) => ({ ...e, blue: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

function EffectRotateControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<RotateEffect>) {
  const onValueChange = (v: number) => onEffect((e) => ({ ...e, value: v }));
  return (
    <YStack>
      <GradientSlider
        label="Rotation"
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={onValueChange}
        sliderFields={sliderFields}
      />
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

function EffectHueShiftControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<HueShiftEffect>) {
  return (
    <YStack>
      <GradientSlider
        label="Hue Shift"
        step={1}
        min={-180}
        max={180}
        value={effect.value}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'value']}
        onValueChange={(v) => onEffect((e) => ({ ...e, value: v }))}
        sliderFields={sliderFields}
      />
    </YStack>
  );
}

export function EffectsScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene?: Scene | null;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  if (!scene) return <SizableText>No Scene</SizableText>;
  const effects = getSceneEffects(scene);
  return (
    <NarrowScrollView>
      <StackScreen title={`Fx: ${getScreenTitle(scene, controlPath)}`} headerBackTitle={' '} />
      <Section title="Effect Order">
        {effects?.map((effect) => (
          <Button onPress={navigate(`control/${controlPath.join(':')}:effect_${effect.key}`)} key={effect.key}>
            {effect.type}
          </Button>
        ))}
        {effects?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            No Effects Yet
          </Text>
        ) : null}
        <XStack gap="$4" padding="$4">
          <NewEffectButton
            getFollowupPath={(key) => `control/${controlPath.join(':')}:effect_${key}`}
            onEffects={(updater) =>
              onScene((s) => ({
                ...s,
                effects: updater(getSceneEffects(s)),
              }))
            }
          />
          <Button
            chromeless
            onPress={navigate(`reorder_effects/${controlPath.slice(0, -1).join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Effect Order
          </Button>
        </XStack>
      </Section>
    </NarrowScrollView>
  );
}
