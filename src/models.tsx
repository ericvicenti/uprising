import { navigate } from '@rise-tools/kit-react-navigation/server';
import {
  AnimatedProgress,
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  Label,
  Slider,
  SliderThumb,
  SliderTrack,
  SliderTrackActive,
  Spinner,
  Text,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { lookup, view } from '@rise-tools/server';
import { MediaIndex, mediaIndex } from './media';
import { createBlankMedia, mainState, mainStateUpdate, sceneState, updateRootMedia } from './state';
import { Media, Transition, TransitionState, VideoScene } from './state-schema';
import { LucideIcon, WebView } from '@rise-tools/kitchen-sink/server';

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
        <Button onPress={navigate('browse_videos')}>Browse Media</Button>
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
    const media = sceneState.get(controlPath);
    return view((get) => (
      <MediaScreen
        media={media ? get(media) : null}
        onMedia={(updater) => {
          updateRootMedia(controlPath, updater);
        }}
        controlPath={controlPath}
        onGetMediaIndex={() => get(mediaIndex)}
      />
    ));
  }),
};

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

function MediaScreen({
  media,
  onMedia,
  controlPath,
  onGetMediaIndex,
}: {
  media: Media | null | undefined;
  onMedia: (update: (m: Media) => Media) => void;
  controlPath: string;
  onGetMediaIndex: () => MediaIndex | undefined;
}) {
  if (media?.type === 'video') {
    return <VideoScreen media={media} onMedia={onMedia} controlPath={controlPath} index={onGetMediaIndex()} />;
  }
  return (
    <YStack>
      <Text>{controlPath}</Text>
      <SelectDropdown
        value={media?.type || 'off'}
        options={newMediaOptions}
        onSelect={(key) => {
          onMedia(() => createBlankMedia(key));
        }}
      />
      <Text>{JSON.stringify(media)}</Text>
    </YStack>
  );
}

function VideoScreen({
  media,
  onMedia,
  controlPath,
  index,
}: {
  media: VideoScene;
  onMedia: (update: (m: Media) => Media) => void;
  controlPath: string;
  index: MediaIndex | undefined;
}) {
  return (
    <YStack>
      <Text>{controlPath}</Text>
      <SelectDropdown
        value={media?.type || 'off'}
        options={newMediaOptions}
        onSelect={(key) => {
          onMedia(() => createBlankMedia(key));
        }}
      />
      {index?.files ? (
        <SelectDropdown
          value={media?.track}
          options={index?.files.map((file) => ({ key: file.fileSha256, label: file.title }))}
          onSelect={(key) => {
            onMedia(() => ({ ...media, track: key, label: index.files.find((f) => f.fileSha256 === key)?.title }));
          }}
        />
      ) : null}
      {/* <Text>{JSON.stringify(media)}</Text> */}
      {/* <Text>{JSON.stringify(index?.files)}</Text> */}
    </YStack>
  );
}

function SelectDropdown<Options extends Readonly<{ label: string; key: string }[]>>({
  value,
  options,
  onSelect,
}: {
  value: Options[number]['key'] | null;
  options: Options;
  onSelect: (key: Options[number]['key']) => void;
}) {
  return (
    <BottomSheet
      trigger={<BottomSheetTriggerButton>{options.find((o) => o.key === value)?.label}</BottomSheetTriggerButton>}
    >
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
