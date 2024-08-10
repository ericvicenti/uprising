import { navigate } from '@rise-tools/kit-react-navigation/server';
import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  Text,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { lookup, view } from '@rise-tools/server';
import { MediaIndex, mediaIndex } from './media';
import { createBlankMedia, mainState, mediaState, updateRootMedia } from './state';
import { Media, VideoMedia } from './state-schema';

export const models = {
  home: view((get) => (
    <YStack gap="$4" padding="$4">
      <Button onPress={navigate('media/live')}>Live</Button>
      <Button onPress={navigate('media/ready')}>Ready</Button>
      <Text>{JSON.stringify(get(mainState))}</Text>
      <Button onPress={navigate('browse_videos')}>Browse Media</Button>
      <Button onPress={navigate('browse_media')}>Browse Library</Button>
    </YStack>
  )),
  browse_videos: view((get) => {
    const media = get(mediaIndex);
    console.log(media);
    return (
      <YStack gap="$4" padding="$4">
        {media?.files?.map((file) => <Button onPress={() => {}}>{file.title}</Button>)}
      </YStack>
    );
  }),
  media: lookup((mediaPath) => {
    const media = mediaState.get(mediaPath);
    return view((get) => (
      <MediaScreen
        media={media ? get(media) : null}
        onMedia={(updater) => {
          updateRootMedia(mediaPath, updater);
        }}
        mediaPath={mediaPath}
        onGetMediaIndex={() => get(mediaIndex)}
      />
    ));
  }),
};

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
  mediaPath,
  onGetMediaIndex,
}: {
  media: Media | null | undefined;
  onMedia: (update: (m: Media) => Media) => void;
  mediaPath: string;
  onGetMediaIndex: () => MediaIndex | undefined;
}) {
  if (media?.type === 'video') {
    return <VideoScreen media={media} onMedia={onMedia} mediaPath={mediaPath} index={onGetMediaIndex()} />;
  }
  return (
    <YStack>
      <Text>{mediaPath}</Text>
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
  mediaPath,
  index,
}: {
  media: VideoMedia;
  onMedia: (update: (m: Media) => Media) => void;
  mediaPath: string;
  index: MediaIndex | undefined;
}) {
  return (
    <YStack>
      <Text>{mediaPath}</Text>
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
