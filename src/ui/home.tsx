import { AnimatedProgress, Button, LucideIcon, XStack, YStack } from '@rise-tools/kitchen-sink/server';
import { MainState, Transition, TransitionState } from '../state-schema';
import { getScreenTitle, NarrowScrollView, Section } from './common';
import { navigate } from '@rise-tools/kit-react-navigation/server';
import { mainStateUpdate, startAutoTransition } from '../state';
import { EditTransition } from './transition';

export function HomeScreen({ state }: { state: MainState }) {
  return (
    <NarrowScrollView>
      <YStack gap="$4" padding="$4">
        <XStack gap="$4">
          <YStack f={1} gap="$2">
            <Button flex={1} onPress={navigate('control/live')} height={80}>
              Live: {getScreenTitle(state.liveScene, ['live'])}
            </Button>
            <Button chromeless icon={<LucideIcon icon="LayoutDashboard" />} onPress={navigate('dashboard/live')}>
              Live Dashboard
            </Button>
          </YStack>
          <YStack f={1} gap="$2">
            <Button flex={1} onPress={navigate('control/ready')}>
              Ready: {getScreenTitle(state.readyScene, ['ready'])}
            </Button>
            <Button chromeless icon={<LucideIcon icon="LayoutDashboard" />} onPress={navigate('dashboard/ready')}>
              Ready Dashboard
            </Button>
          </YStack>
        </XStack>
        <AutoTransitionProgress transitionState={state.transitionState} transition={state.transition} />
        <XStack jc="center">
          <YStack gap="$2">
            <Button
              height={80}
              theme="green"
              paddingHorizontal="$6"
              onPress={() => {
                startAutoTransition();
              }}
              disabled={state.transitionState.autoStartTime !== null}
              icon={<LucideIcon icon="PlayCircle" />}
            >
              Start Transition
            </Button>
            <EditTransition
              transition={state.transition}
              onTransition={(update) =>
                mainStateUpdate((state) => ({ ...state, transition: update(state.transition) }))
              }
            />
          </YStack>
        </XStack>
        {/* <YStack width="100%" aspectRatio={1} backgroundColor="red">
        <WebView
          style={{ flex: 1, backgroundColor: 'white', pointerEvents: 'none' }}
          source={{ uri: 'http://localhost:3000/eg-live' }}
        />
      </YStack> */}
      </YStack>
      <Section title="Library">
        <Button icon={<LucideIcon icon="Library" />} onPress={navigate('browse_videos')}>
          Media
        </Button>
        <Button icon={<LucideIcon icon="Library" />} onPress={navigate('browse_library')}>
          Scenes
        </Button>
      </Section>
      <Section title="Setup">
        <XStack>
          <Button chromeless onPress={navigate(`global_effects`)} icon={<LucideIcon icon="Sparkles" />}>
            Global Effects
          </Button>
          <Button chromeless icon={<LucideIcon icon="Wrench" />} onPress={navigate('admin')}>
            Administration
          </Button>
        </XStack>
      </Section>
    </NarrowScrollView>
  );
}

export function AutoTransitionProgress({
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
    <YStack height={10} paddingHorizontal="$6">
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
