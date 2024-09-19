import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  LucideIcon,
  SheetScrollView,
  YStack,
} from '@rise-tools/kitchen-sink/server';

export function SelectDropdown<Options extends Readonly<{ label: string; key: string }[]>>({
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
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton iconAfter={<LucideIcon icon="ChevronDown" />} {...triggerProps}>
          {triggerLabel ?? options.find((o) => o.key === value)?.label ?? emptyLabel}
        </BottomSheetTriggerButton>
      }
    >
      <SheetScrollView>
        <YStack margin="$3">
          {options.map((option) => (
            <BottomSheetCloseButton
              key={option.key}
              onPress={() => {
                onSelect(option.key);
              }}
              chromeless
              iconAfter={option.key === value ? <LucideIcon icon="Check" /> : null}
            >
              {option.label}
            </BottomSheetCloseButton>
          ))}
        </YStack>
      </SheetScrollView>
    </BottomSheet>
  );
}
