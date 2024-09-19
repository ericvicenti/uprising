import { Button, LucideIcon, Section, Spinner, XStack } from '@rise-tools/kitchen-sink/server';
import { VideoScene } from '../state-schema';
import {
  GenericSceneSection,
  NarrowScrollView,
  ResetSceneButton,
  SceneEffectsButton,
  SceneScreenProps,
} from './common';
import { navigate } from '@rise-tools/kit-react-navigation/server';
import { SelectDropdown } from './dropdown';
import { mainVideo } from '../eg-video-playback';

export function VideoScreen({
  scene,
  onScene,
  controlPath,
  onGetMediaIndex,
  extraControls,
}: SceneScreenProps<VideoScene>) {
  const index = onGetMediaIndex();
  const trackOptions = index?.files.map((file) => ({ key: file.id, label: file.title }));
  return (
    <NarrowScrollView>
      <Section title="Video">
        {scene?.track ? (
          <Button
            flex={1}
            onPress={navigate(`browse_videos/${scene.track}`)}
            iconAfter={<LucideIcon icon="ChevronRight" />}
          >
            {index?.files.find((file) => file.id === scene.track)?.title || scene.track}
          </Button>
        ) : index?.files ? (
          trackOptions && (
            <SelectDropdown
              emptyLabel="Select a video track"
              value={scene?.track}
              options={trackOptions}
              onSelect={(key) => {
                onScene((scene) => ({ ...scene, track: key, label: index.files.find((f) => f.id === key)?.title }));
              }}
            />
          )
        ) : (
          <Spinner />
        )}
        <XStack gap="$4">
          <Button
            theme="green"
            icon={<LucideIcon icon="RotateCcw" />}
            onPress={() => {
              const player = mainVideo.getPlayer(scene.id);
              player?.restart();
            }}
          >
            Restart Video
          </Button>
          {trackOptions && scene.track ? (
            <SelectDropdown
              triggerLabel="Swap Media"
              triggerProps={{ icon: <LucideIcon icon="Library" />, chromeless: true }}
              value={scene?.track}
              options={trackOptions}
              onSelect={(key) => {
                onScene((scene) => ({
                  ...scene,
                  track: key,
                  label: index?.files.find((f) => f.id === key)?.title || '?',
                }));
              }}
            />
          ) : null}
        </XStack>
        {/* <Text>{JSON.stringify(scene)}</Text> */}
        {/* <Text>{JSON.stringify(index?.files)}</Text> */}
        <SceneEffectsButton controlPath={controlPath} />
      </Section>

      {extraControls}
      <GenericSceneSection controlPath={controlPath} scene={scene} onScene={onScene}>
        <XStack gap="$4">
          <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
        </XStack>
      </GenericSceneSection>
    </NarrowScrollView>
  );
}
