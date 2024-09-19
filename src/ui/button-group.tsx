import { BottomSheetCloseButton, Button, XStack } from '@rise-tools/kitchen-sink/server';
import { JSXElement } from './common';

export function ButtonGroup({
  items,
  ...props
}: {
  items?: { key: string; label: string; onPress: Parameters<typeof BottomSheetCloseButton>[0]['onPress'] }[];
  Button?: (props: Parameters<typeof BottomSheetCloseButton>[0]) => JSXElement;
}) {
  const ButtonComponent = props.Button || Button;
  if (!items) return null;
  return (
    <XStack gap="$1" flexWrap="wrap" jc="center">
      {items.map((item) => (
        <ButtonComponent
          size="$3"
          marginBottom="$1"
          key={item.key}
          onPress={item.onPress}
          flexGrow={1}
          flexShrink={0}
          flexBasis="30%"
          maxWidth={300}
          minWidth={240}
        >
          {item.label}
        </ButtonComponent>
      ))}
    </XStack>
  );
}
