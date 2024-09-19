import {
  BottomSheet,
  BottomSheetTriggerButton,
  Button,
  Label,
  LucideIcon,
  Section,
  SheetScrollView,
  SmoothSlider,
  Text,
  toast,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { SliderFields } from '../state-schema';
import { JSXElement } from './common';
import { addBounceToDashboard, addSliderToDashboard, bounceTimes, mainStateUpdate } from '../state';
import { response } from '@rise-tools/react';

export function GradientSlider({
  label,
  value,
  onValueChange,
  step = 0.01,
  min = 0,
  max = 1,
  sliderFields,
  scenePath,
  fieldPath,
}: {
  label: string;
  value: number;
  onValueChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  sliderFields?: SliderFields;
  scenePath?: string[];
  fieldPath: string[];
}) {
  const innerScenePath = scenePath?.slice(1);
  const sliderField = innerScenePath ? [...innerScenePath, ...fieldPath].join(':') : undefined;
  const fieldSettings = sliderField ? sliderFields?.[sliderField] : {};
  const smoothing = fieldSettings?.smoothing == null ? 0.5 : fieldSettings.smoothing;
  const maxBounceAmount = Math.abs(max - min);
  const bounceAmount = fieldSettings?.bounceAmount == null ? 1 : fieldSettings.bounceAmount;
  const bounceDuration = fieldSettings?.bounceDuration == null ? 1000 : fieldSettings.bounceDuration;
  return (
    <YStack>
      <GradientFieldDropdown
        label={label}
        sliderField={sliderField}
        triggerButtonProps={{
          paddingHorizontal: 0,
          size: '$2',
          chromeless: true,
          justifyContent: 'flex-start',
        }}
        triggerButtonContent={
          <XStack ai="center" jc="space-between" flex={1}>
            <XStack ai="center" gap="$2">
              <Text>{label}</Text>
              <LucideIcon icon="Gauge" />
            </XStack>
            <Text>{value}</Text>
          </XStack>
        }
        bounceAmount={bounceAmount}
        maxBounceAmount={maxBounceAmount}
        bounceDuration={bounceDuration}
        smoothing={smoothing}
        scenePath={scenePath}
        fieldPath={fieldPath}
        step={step}
        min={min}
        max={max}
        value={value}
        onValueChange={onValueChange}
      />
      <SmoothSlider
        value={value}
        min={min == undefined ? 0 : min}
        step={step == undefined ? 0.01 : step}
        max={max == undefined ? 1 : max}
        onValueChange={(v) => onValueChange(v)}
        size={50}
        smoothing={smoothing}
      />
    </YStack>
  );
}

export function GradientFieldDropdown({
  label,
  bounceAmount,
  maxBounceAmount,
  bounceDuration,
  smoothing,
  scenePath,
  fieldPath,
  step,
  min,
  max,
  value,
  onValueChange,
  sliderField,
  triggerButtonProps,
  triggerButtonContent,
}: {
  label: string;
  sliderField?: string;
  triggerButtonProps: Parameters<typeof BottomSheetTriggerButton>[0];
  triggerButtonContent?: JSXElement;
  bounceAmount: number;
  maxBounceAmount: number;
  bounceDuration: number;
  smoothing: number;
  scenePath?: string[];
  fieldPath: string[];
  step?: number;
  min?: number;
  max?: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  const onSliderFields = scenePath ? getSliderFieldUpdater(scenePath) : undefined;

  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton {...triggerButtonProps}>{triggerButtonContent ?? label}</BottomSheetTriggerButton>
      }
    >
      <SheetScrollView>
        <Section title={label}>
          <SmoothSlider
            value={value}
            min={min == undefined ? 0 : min}
            step={step == undefined ? 0.01 : step}
            max={max == undefined ? 1 : max}
            onValueChange={(v) => onValueChange(v)}
            size={50}
            smoothing={smoothing}
          />
          {onSliderFields && sliderField ? (
            <>
              <Label>Smoothing</Label>
              <SmoothSlider
                value={smoothing}
                step={0.01}
                max={1}
                size={50}
                smoothing={0}
                onValueChange={(v) => {
                  onSliderFields((fields) => ({
                    ...fields,
                    [sliderField]: { ...(fields[sliderField] || {}), smoothing: v },
                  }));
                }}
              />
            </>
          ) : null}
        </Section>
        {onSliderFields && scenePath && sliderField ? (
          <Section title="Value Bounce">
            <Label>Amount: {Math.round(bounceAmount * 10) / 10}</Label>
            <SmoothSlider
              value={bounceAmount}
              step={step}
              max={maxBounceAmount}
              min={-maxBounceAmount}
              size={50}
              smoothing={0}
              onValueChange={(v) => {
                onSliderFields((fields) => ({
                  ...fields,
                  [sliderField]: { ...(fields[sliderField] || {}), bounceAmount: v },
                }));
              }}
            />
            <Label>Duration: {Math.round(bounceDuration / 100) / 10} sec</Label>
            <SmoothSlider
              value={bounceDuration}
              max={6_000}
              min={0}
              step={10}
              size={50}
              smoothing={0}
              onValueChange={(v) => {
                onSliderFields((fields) => ({
                  ...fields,
                  [sliderField]: { ...(fields[sliderField] || {}), bounceDuration: v },
                }));
              }}
            />
            <Button
              onPress={() => {
                const fullBounceKey = [...scenePath, ...fieldPath].join(':');
                bounceTimes[fullBounceKey] = Date.now();
              }}
            >
              Trigger Bounce
            </Button>
          </Section>
        ) : null}
        {scenePath ? (
          <Section title="Dashboard">
            <Button
              onPress={async () => {
                await addSliderToDashboard(scenePath, fieldPath);
                return response(toast(`Added ${label} Slider to Dashboard`));
              }}
            >
              Add Slider to Dashboard
            </Button>
            <Button
              onPress={async () => {
                await addBounceToDashboard(scenePath, fieldPath);
                return response(toast(`Added ${label} Bounce Button to Dashboard`));
              }}
            >
              Add Bounce to Dashboard
            </Button>
          </Section>
        ) : null}
      </SheetScrollView>
    </BottomSheet>
  );
}

function getSliderFieldUpdater(scenePath: string[]) {
  return (update: (m: SliderFields) => SliderFields) => {
    const key = scenePath[0] === 'live' ? 'liveSliderFields' : 'readySliderFields';
    mainStateUpdate((state) => {
      return { ...state, [key]: update(state[key] || {}) };
    });
  };
}
