import { SmoothSlider, Switch, SwitchThumb, Text, XStack, YStack } from '@rise-tools/kitchen-sink/server';

export function NumericField({
  label,
  value,
  step,
  min,
  max,
  onValueChange,
  unit,
}: {
  label: string;
  value: number;
  step?: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <YStack gap="$1" marginVertical="$1">
      <XStack jc="space-between">
        <Text>{label}</Text>
        <Text color="$color9">
          {value}
          {unit ? ` ${unit}` : ''}
        </Text>
      </XStack>
      <SmoothSlider
        value={value}
        onValueChange={onValueChange}
        step={step ?? 1}
        min={min}
        max={max}
        size={40}
        smoothing={0}
      />
    </YStack>
  );
}

export function SwitchField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <YStack gap="$1" marginVertical="$1">
      <Text>{label}</Text>
      <Switch checked={value} backgroundColor={value ? '$green9' : null} onCheckedChange={onValueChange}>
        <SwitchThumb backgroundColor="$color11" />
      </Switch>
    </YStack>
  );
}
