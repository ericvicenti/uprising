import {
  BottomSheet,
  BottomSheetTriggerButton,
  Button,
  Group,
  GroupItem,
  Label,
  LucideIcon,
  SmoothSlider,
} from '@rise-tools/kitchen-sink/server';
import { DefaultTransition, Transition } from '../state-schema';
import { DefaultTransitionDuration } from '../constants';

export function EditTransition({
  transition,
  onTransition,
}: {
  transition: Transition;
  onTransition: (update: (t: Transition) => Transition) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Presentation" />}>
          Set Transition
        </BottomSheetTriggerButton>
      }
    >
      <EditTransitionForm transition={transition ?? DefaultTransition} onTransition={onTransition} />
    </BottomSheet>
  );
}

export function EditTransitionForm({
  transition,
  onTransition,
}: {
  transition: Transition;
  onTransition: (updater: (t: Transition) => Transition) => void;
}) {
  function setMode(mode: Transition['mode']) {
    onTransition((transition) => {
      return { ...transition, mode };
    });
  }
  return (
    <>
      <Label>Transition Mode</Label>
      <Group orientation="horizontal" gap="$4">
        <GroupItem>
          <Button
            onPress={() => {
              setMode('mix');
            }}
            {...(transition.mode === 'mix' ? { backgroundColor: '$color7', icon: <LucideIcon icon="Check" /> } : {})}
          >
            Mix
          </Button>
        </GroupItem>
        <GroupItem>
          <Button
            onPress={() => {
              setMode('add');
            }}
            {...(transition.mode === 'add' ? { backgroundColor: '$color7', icon: <LucideIcon icon="Check" /> } : {})}
          >
            Add
          </Button>
        </GroupItem>
      </Group>
      <Label>Duration: {Math.floor((transition?.duration ?? DefaultTransitionDuration) / 100) / 10} sec</Label>
      <SmoothSlider
        value={transition?.duration ?? DefaultTransition.duration}
        onValueChange={(v) =>
          onTransition((t) => {
            return { ...t, duration: v };
          })
        }
        smoothing={0}
        size={50}
        min={0}
        step={10}
        max={15000}
      />
    </>
  );
}
