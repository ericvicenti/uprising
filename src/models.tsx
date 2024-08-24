import { goBack, navigate, StackScreen } from '@rise-tools/kit-react-navigation/server';
import { AnimatedProgress, SmoothSlider } from '@rise-tools/kit/server';
import {
  BottomSheet,
  BottomSheetCloseButton,
  BottomSheetTriggerButton,
  Button,
  DraggableFlatList,
  Group,
  GroupItem,
  Heading,
  InputField,
  Label,
  LucideIcon,
  openURL,
  RiseForm,
  ScrollView,
  Separator,
  Sheet,
  SheetScrollView,
  SizableText,
  Spinner,
  SubmitButton,
  Text,
  toast,
  View,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { createComponentDefinition, ref, response } from '@rise-tools/react';
import { lookup, view } from '@rise-tools/server';
import { randomUUID } from 'crypto';
import { hslToHex } from './color';
import { getSequenceActiveItem } from './eg-main';
import { mainVideo } from './eg-video-playback';
import { deleteLibraryItem, getLibraryItem, libraryIndex, renameLibraryItem, writeLibraryItem } from './library';
import {
  deleteMediaFile,
  duplicateFile,
  importMedia,
  ImportState,
  importState,
  MediaFile,
  MediaIndex,
  mediaIndex,
  renameMediaFile,
} from './media';
import {
  addBounceToDashboard,
  addSliderToDashboard,
  bounceTimes,
  createBlankEffect,
  createBlankScene,
  dashboards,
  DashboardSliderState,
  DashboardState,
  DashboardStateItem,
  editDashboard,
  mainState,
  mainStateUpdate,
  sceneState,
  sliderFields,
  startAutoTransition,
  updateScene,
} from './state';
import {
  BrightenEffect,
  ColorizeEffect,
  ColorScene,
  ContrastEffect,
  DarkenEffect,
  Dashboard,
  DashboardItem,
  DesaturateEffect,
  Effect,
  HueShiftEffect,
  Layer,
  LayersScene,
  MainState,
  OffScene,
  RotateEffect,
  Scene,
  SequenceItem,
  SequenceScene,
  SliderFields,
  Transition,
  TransitionState,
  VideoScene,
} from './state-schema';
import { DefaultBounceAmount, DefaultBounceDuration, DefaultSmoothing } from './constants';
// import { isEqual } from 'lodash';
type JSXElement = ReturnType<ReturnType<typeof createComponentDefinition>>;

function isEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export const models = {
  home: view(
    (get) => {
      const state = get(mainState);
      if (!state) return <Spinner />;
      return (
        <>
          <YStack gap="$4" padding="$4">
            <XStack gap="$1">
              <Button flex={1} onPress={navigate('control/live')}>
                Live: {getScreenTitle(state.liveScene, ['live'])}
              </Button>
              <Button chromeless icon={<LucideIcon icon="LayoutDashboard" />} onPress={navigate('dashboard/live')} />
            </XStack>
            <XStack gap="$1">
              <Button flex={1} onPress={navigate('control/ready')}>
                Ready: {getScreenTitle(state.readyScene, ['ready'])}
              </Button>
              <Button chromeless icon={<LucideIcon icon="LayoutDashboard" />} onPress={navigate('dashboard/ready')} />
            </XStack>
            <Button
              onPress={() => {
                startAutoTransition();
              }}
              disabled={state.transitionState.manual !== null}
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
            <AutoTransitionProgress transitionState={state.transitionState} transition={state.transition} />
            {/* <YStack width="100%" aspectRatio={1} backgroundColor="red">
        <WebView
          style={{ flex: 1, backgroundColor: 'white', pointerEvents: 'none' }}
          source={{ uri: 'http://localhost:3000/eg-live' }}
        />
      </YStack> */}
            {/* <Text>{JSON.stringify(get(mainState))}</Text> */}
          </YStack>
          <Section title="Library">
            <Button icon={<LucideIcon icon="Library" />} onPress={navigate('browse_videos')}>
              Media
            </Button>
            <Button icon={<LucideIcon icon="Library" />} onPress={navigate('browse_library')}>
              Scenes
            </Button>
          </Section>
        </>
      );
    },
    { compare: isEqual }
  ),
  dashboard: lookup((dashboardKey) => {
    const dashboard = dashboards.get(dashboardKey);
    return view((get) => {
      const dashboardState = dashboard ? get(dashboard) : undefined;
      if (dashboardKey !== 'live' && dashboardKey !== 'ready') return <Text>Unknown Dashboard</Text>;
      return <DashboardScreen dashboardKey={dashboardKey} dashboard={dashboardState} />;
    });
  }),
  dashboard_edit: lookup((dashboardKey) => {
    const dashboard = dashboards.get(dashboardKey);
    return view((get) => {
      const dashboardState = dashboard ? get(dashboard) : undefined;
      if (dashboardKey !== 'live' && dashboardKey !== 'ready') return <Text>Unknown Dashboard</Text>;
      return <EditDashboardScreen dashboardKey={dashboardKey} dashboard={dashboardState} />;
    });
  }),
  dashboard_edit_item: lookup((dashboardKey) => {
    return lookup((itemKey) => {
      return view((get) => {
        const dashboard = dashboards.get(dashboardKey);
        const dashboardState = dashboard ? get(dashboard) : undefined;
        const item = dashboardState?.items?.find((i) => i.key === itemKey);
        if (dashboardKey !== 'live' && dashboardKey !== 'ready') return <Text>Unknown Dashboard</Text>;
        if (!item) return <Text>Unknown Item</Text>;
        return <EditDashboardItemScreen dashboardKey={dashboardKey} item={item} />;
      });
    });
  }),
  browse_videos: lookup((fileId) =>
    view(
      (get) => {
        const media = get(mediaIndex);
        if (fileId !== '') return <MediaFileScreen file={media?.files.find((file) => file.id === fileId)} />;
        const importing = get(importState);

        return <BrowseMediaScreen media={media} importing={importing} />;
      },
      { compare: isEqual }
    )
  ),
  browse_library: lookup((libraryId) =>
    view(
      (get) => {
        if (libraryId !== '') return <LibraryItemScreen item={libraryId} />;
        const lib = get(libraryIndex);
        return (
          <ScrollView>
            <YStack gap="$4" padding="$4">
              {lib?.map((file) => <Button onPress={navigate(`browse_library/${file}`)}>{file}</Button>)}
            </YStack>
          </ScrollView>
        );
      },
      { compare: isEqual }
    )
  ),
  reset_scene: lookup((scenePathStr) =>
    view((get) => {
      const scenePath = scenePathStr.split(':');
      const lib = get(libraryIndex);
      const media = get(mediaIndex);
      const onScene = (
        scene: Scene,
        meta?: {
          dashboard?: Dashboard;
          sliderFields?: SliderFields;
        }
      ) => {
        updateScene(scenePath, () => scene);
        if (scenePathStr === 'live') {
          mainStateUpdate((state) => {
            return {
              ...state,
              liveDashboard: meta?.dashboard || [],
              liveSliderFields: meta?.sliderFields || {},
            };
          });
        } else if (scenePathStr === 'ready') {
          mainStateUpdate((state) => {
            return {
              ...state,
              readyDashboard: meta?.dashboard || [],
              readySliderFields: meta?.sliderFields || {},
            };
          });
        }
      };
      return <NewScenePicker onScene={onScene} library={lib} media={media} />;
    })
  ),
  add_scene: lookup((scenePath) =>
    view((get) => {
      const lib = get(libraryIndex);
      const media = get(mediaIndex);

      return (
        <NewScenePicker
          library={lib}
          media={media}
          onScene={(newChildScene) => {
            const key = randomUUID();
            let navigatePath: string | undefined = undefined;
            updateScene(scenePath.split(':'), (scene: Scene) => {
              if (scene.type === 'layers') {
                const newLayer: Layer = {
                  scene: newChildScene,
                  key,
                  blendMode: 'mix',
                  blendAmount: 0,
                };
                navigatePath = `${scenePath}:layer_${key}`;
                return { ...scene, layers: [newLayer, ...(scene.layers || [])] };
              }
              if (scene.type === 'sequence') {
                const newItem: SequenceItem = {
                  scene: newChildScene,
                  key,
                };
                navigatePath = `${scenePath}:item_${key}`;
                return { ...scene, sequence: [...(scene.sequence || []), newItem] };
              }
              return scene;
            });
            if (navigatePath) {
              return response(navigate(`control/${navigatePath}`));
            }
          }}
        />
      );
    })
  ),
  control: lookup((controlPath) => {
    console.log('control', controlPath);
    const path = controlPath.split(':');
    const { scenePath, restPath } = unpackControlPath(path);
    const scene = sceneState.get(scenePath.join(':'));
    const sliderFieldsModel = sliderFields.get(path[0]);
    if (restPath[0] === 'effects') {
      if (restPath[1]) {
        const effectId = restPath[1].split('_')[1];
        return view(
          (get) => (
            <EffectScreen
              scene={scene ? get(scene) : null}
              controlPath={path}
              effectId={effectId}
              onScene={(updater) => {
                updateScene(scenePath, updater);
              }}
              sliderFields={sliderFieldsModel ? get(sliderFieldsModel) : undefined}
            />
          ),
          { compare: isEqual }
        );
      }
      return view(
        (get) => {
          return (
            <EffectsScreen
              scene={scene ? get(scene) : null}
              onScene={(updater) => {
                updateScene(scenePath, updater);
              }}
              controlPath={path}
            />
          );
        },
        { compare: isEqual }
      );
    }
    if (restPath.length) {
      return () => <Text>Unrecognized Control Path</Text>;
    }
    return view(
      (get) => {
        let extraControls = null;
        if (path.at(-1)?.startsWith('layer_')) {
          const layerKey = path.at(-1)?.slice(6);
          const layersPath = path.slice(0, -1);
          const layersSceneModel = sceneState.get(layersPath.join(':'));
          const layersScene = layersSceneModel ? get(layersSceneModel) : null;
          const sliderFieldsModel = sliderFields.get(path[0]);
          if (layersScene?.type === 'layers' && layerKey) {
            extraControls = (
              <LayerControls
                layersScene={layersScene}
                layerKey={layerKey}
                scenePath={layersPath}
                sliderFields={sliderFieldsModel ? get(sliderFieldsModel) : undefined}
                onScene={(updater) => {
                  updateScene(layersPath, updater);
                }}
              />
            );
          }
        }
        if (path.at(-1)?.startsWith('item_')) {
          const itemKey = path.at(-1)?.slice(5);
          const sequencePath = path.slice(0, -1);
          const sequenceSceneModel = sceneState.get(sequencePath.join(':'));
          const sequenceScene = sequenceSceneModel ? get(sequenceSceneModel) : null;
          if (sequenceScene?.type === 'sequence' && itemKey) {
            extraControls = (
              <SqeuenceItemControls
                sequenceScene={sequenceScene}
                itemKey={itemKey}
                onScene={(updater) => {
                  updateScene(sequencePath, updater);
                }}
              />
            );
          }
        }
        const sliderFieldsModel = sliderFields.get(path[0]);
        return (
          <SceneScreen
            scene={scene ? get(scene) : null}
            extraControls={extraControls}
            sliderFields={sliderFieldsModel ? get(sliderFieldsModel) : undefined}
            onScene={(updater) => {
              updateScene(scenePath, updater);
            }}
            controlPath={path}
            onGetMediaIndex={() => get(mediaIndex)}
          />
        );
      },
      { compare: isEqual }
    );
  }),
};

function LibraryItemScreen({ item }: { item: string }) {
  return (
    <ScrollView>
      <StackScreen title={item} />
      <Button
        onPress={async () => {
          const itemValue = await getLibraryItem(item);
          mainStateUpdate((state) => {
            return {
              ...state,
              readyScene: itemValue.scene,
              readyDashboard: itemValue.dashboard,
              readySliderFields: itemValue.sliderFields,
            };
          });
          return response(navigate('control/ready'));
        }}
        icon={<LucideIcon icon="PlayCircle" />}
      >
        Play on Ready
      </Button>
      <Section title="Rename Item">
        <RiseForm
          onSubmit={async (values) => {
            await renameLibraryItem(item, values.label);
            return response(goBack());
          }}
        >
          <InputField id="label" label="Name" value={item} />
          <SubmitButton>Rename</SubmitButton>
        </RiseForm>
      </Section>
      <Button
        onPress={async () => {
          await deleteLibraryItem(item);
          return response(goBack());
        }}
      >
        Delete from Library
      </Button>
    </ScrollView>
  );
}

function NewScenePicker({
  onScene,
  media,
  library,
}: {
  onScene: (scene: Scene, other?: { dashboard?: Dashboard; sliderFields?: SliderFields }) => void;
  media: MediaIndex | undefined;
  library?: string[];
}) {
  return (
    <SheetScrollView>
      <YStack>
        <Section title="Media">
          {media?.files?.map((file) => (
            <BottomSheetCloseButton
              key={`media-${file.id}`}
              onPress={() => {
                return onScene({
                  type: 'video',
                  id: randomUUID(),
                  track: file.id,
                  label: file.title,
                });
              }}
            >
              {file.title}
            </BottomSheetCloseButton>
          ))}
        </Section>
        <Section title="Library">
          {library?.map((libraryItem) => (
            <BottomSheetCloseButton
              key={`lib-${libraryItem}`}
              onPress={async () => {
                const item = await getLibraryItem(libraryItem);
                return onScene(item.scene, { dashboard: item.dashboard, sliderFields: item.sliderFields });
              }}
            >
              {libraryItem}
            </BottomSheetCloseButton>
          ))}
        </Section>
        <Section title="New Scene">
          {SceneTypes.map(({ key, label }) => (
            <BottomSheetCloseButton
              key={`new-${key}`}
              onPress={() => {
                return onScene(createBlankScene(key));
              }}
            >
              {label}
            </BottomSheetCloseButton>
          ))}
        </Section>
      </YStack>
    </SheetScrollView>
  );
}

function BrowseMediaScreen({
  media,
  importing,
}: {
  media: MediaIndex | undefined;
  importing: ImportState | null | undefined;
}) {
  return (
    <ScrollView>
      <YStack gap="$1" padding="$4">
        {media?.files?.map((file) => (
          <Button size="$3" onPress={navigate(`browse_videos/${file.id}`)}>
            {file.title}
          </Button>
        ))}
      </YStack>
      <Section title="Import">
        <RiseForm
          onSubmit={(values) => {
            importMedia(values.url)
              .then(() => {
                // console.log('done.');
              })
              .catch((e) => {
                console.error(e);
              });
          }}
        >
          <InputField id="url" label="URL" />
          <SubmitButton>Start Import</SubmitButton>
        </RiseForm>
        {importing?.importing?.map((importItem) => (
          <YStack marginVertical="$3" key={importItem.id}>
            <Text>{importItem.url}</Text>
            <Text color="$color8">{importItem.state}</Text>
          </YStack>
        ))}
      </Section>
    </ScrollView>
  );
}

function MediaFileScreen({ file }: { file: MediaFile | undefined }) {
  if (!file) return <SizableText>No File</SizableText>;
  return (
    <ScrollView>
      <StackScreen title={file.title} />
      <YStack gap="$4" padding="$4">
        <Text>{file.title}</Text>
        <Text color="$blue9" onPress={openURL(file.sourceUrl)}>
          {file.sourceUrl}
        </Text>
        <Button
          icon={<LucideIcon icon="PlayCircle" />}
          onPress={() => {
            mainStateUpdate((state) => {
              return { ...state, readyScene: { ...createBlankScene('video'), track: file.id, label: file.title } };
            });
            return response(navigate('control/ready'));
          }}
        >
          Play on Ready
        </Button>
      </YStack>
      <Section title="Rename File">
        <RiseForm
          onSubmit={async (values) => {
            await renameMediaFile(file.id, values.title);
          }}
        >
          <InputField id="title" label="Name" value={file.title} />
          <SubmitButton>Rename</SubmitButton>
        </RiseForm>
      </Section>
      <YStack gap="$4" padding="$4">
        <Button
          onPress={() => {
            duplicateFile(file.id);
            return response(goBack());
          }}
        >
          Duplicate File
        </Button>
        <Button
          onPress={() => {
            deleteMediaFile(file.id);
            return response(goBack());
          }}
        >
          Delete File
        </Button>
      </YStack>
    </ScrollView>
  );
}

function DashboardScreen({ dashboard, dashboardKey }: { dashboardKey: string; dashboard?: DashboardState }) {
  const title = dashboardKey === 'live' ? 'Live Dashboard' : 'Ready Dashboard';
  return (
    <ScrollView>
      <StackScreen title={title} headerBackTitle={' '} />
      <YStack gap="$4" padding="$4">
        {dashboard?.items?.filter((item) => !!item).map((item) => <DashboardItem item={item} key={item.key} />)}
        <Button
          marginTop="$5"
          onPress={navigate('dashboard_edit/' + dashboardKey)}
          icon={<LucideIcon icon="Settings2" />}
        >
          Edit Dashboard
        </Button>
      </YStack>
    </ScrollView>
  );
}

function EditDashboardScreen({
  dashboard,
  dashboardKey,
}: {
  dashboardKey: 'live' | 'ready';
  dashboard?: DashboardState;
}) {
  const title = dashboardKey === 'live' ? 'Edit Live Dashboard' : 'Edit Ready Dashboard';
  return (
    <>
      <StackScreen title={title} headerBackTitle={' '} />
      <DraggableFlatList
        style={{ height: '100%' }}
        header={<View height="$3" />}
        data={
          dashboard?.items?.map((item) => ({
            label: (
              <Button marginHorizontal="$4" marginVertical="$1" disabled>
                {item.breadcrumbs.map((b) => b.label).join(': ') + ': ' + item.label}
              </Button>
            ),
            key: item.key,
            onPress: navigate(`dashboard_edit_item/${dashboardKey}/${item.key}`),
          })) || []
        }
        onReorder={(keyOrder) => {
          editDashboard(dashboardKey, (d) => keyOrder.map((key) => d.find((i) => i.key === key)!));
        }}
      />
    </>
  );
}

function EditDashboardItemScreen({ item, dashboardKey }: { item: DashboardStateItem; dashboardKey: 'live' | 'ready' }) {
  return (
    <YStack padding="$4" gap="$4">
      <StackScreen title={item.label} headerBackTitle={' '} />
      <DashboardItemHeader item={item} />
      <SizableText color="$color9">{item.hardwareLabel}</SizableText>
      <Button
        icon={<LucideIcon icon="Trash" />}
        onPress={() => {
          editDashboard(dashboardKey, (d) => d.filter((i) => i.key !== item.key));
          return response(goBack());
        }}
      >
        Remove from Dashboard
      </Button>
    </YStack>
  );
}

function DashboardGradientDropdown({ item, slider }: { item: DashboardStateItem; slider: DashboardSliderState }) {
  const { scenePath, field } = item;
  const { label, value, step, onValue, smoothing, fieldPath, bounceAmount, bounceDuration } = slider;
  const min = slider.min ?? 0;
  const max = slider.max ?? 1;

  return (
    <GradientFieldDropdown
      label={label}
      scenePath={[item.dashboardId, ...scenePath]}
      value={value}
      onValueChange={onValue}
      min={min}
      max={max}
      step={step ?? 0.01}
      smoothing={smoothing ?? DefaultSmoothing}
      sliderField={field}
      triggerButtonProps={{
        size: '$2',
        theme: 'blue',
        iconAfter: <LucideIcon icon="Gauge" />,
      }}
      onSliderFields={getSliderFieldUpdater(scenePath)}
      fieldPath={fieldPath}
      bounceAmount={bounceAmount ?? DefaultBounceAmount}
      bounceDuration={bounceDuration ?? DefaultBounceDuration}
      maxBounceAmount={Math.abs(max - min)}
    />
  );
}

function DashboardItemHeader({ item }: { item: DashboardStateItem }) {
  return (
    <YStack justifyContent="space-between" gap="$2" marginVertical="$2">
      <XStack flexWrap="wrap" gap="$3">
        {item.breadcrumbs.map((breadcrumbItem) => (
          <Button
            paddingHorizontal="$1"
            size="$2"
            chromeless
            onPress={navigate(`control/${breadcrumbItem.controlPath.join(':')}`)}
          >
            {breadcrumbItem.label}
          </Button>
        ))}
        {item.slider ? <DashboardGradientDropdown item={item} slider={item.slider} /> : <Text>{item.label}</Text>}
      </XStack>
    </YStack>
  );
}

function DashboardItemFooter({ item }: { item: DashboardStateItem }) {
  return (
    <XStack jc="flex-end">
      <Button
        size="$2"
        color="$color8"
        onPress={navigate(`dashboard_edit_item/${item.dashboardId}/${item.key}`)}
        iconAfter={<LucideIcon color="$color8" icon="Settings" />}
        chromeless
      >
        {item.hardwareLabel}
      </Button>
    </XStack>
  );
}

function DashboardItem({ item }: { item: DashboardStateItem }) {
  if (item.type === 'button') {
    return (
      <YStack gap="$1">
        <DashboardItemHeader item={item} />
        <Button
          onPress={() => {
            item.onPress();
          }}
          size="$5"
        >
          {item.buttonLabel}
        </Button>
        <DashboardItemFooter item={item} />
      </YStack>
    );
  } else if (item.type === 'slider') {
    return (
      <YStack gap="$1">
        <DashboardItemHeader item={item} />
        <SmoothSlider
          value={item.slider.value}
          onValueChange={(value) => {
            item.slider.onValue(value);
          }}
          min={item.slider.min ?? 0}
          max={item.slider.max ?? 1}
          step={item.slider.step ?? 0.01}
          smoothing={item.slider.smoothing ?? DefaultSmoothing}
          size={50}
        />
        <DashboardItemFooter item={item} />
      </YStack>
    );
  }
  return null;
}

function unpackControlPath(controlPath: string[]): { scenePath: string[]; restPath: string[] } {
  const scenePath: string[] = [];
  const restPath: string[] = [];
  let isRest = false;
  controlPath.forEach((term) => {
    if (isRest) restPath.push(term);
    if (term === 'live' || term === 'ready') scenePath.push(term);
    if (term.startsWith('layer_')) scenePath.push(term);
    if (term.startsWith('item_')) scenePath.push(term);
    if (term === 'effects') {
      restPath.push(term);
      isRest = true;
    }
  });
  return { scenePath, restPath };
}

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

const SceneTypes = [
  { key: 'off', label: 'Off' },
  { key: 'color', label: 'Color' },
  { key: 'video', label: 'Video' },
  { key: 'layers', label: 'Layers' },
  { key: 'sequence', label: 'Sequence' },
] as const;

type ScreenProps = {
  scene: Scene;
  onScene: (update: (s: Scene) => Scene) => void;
  controlPath: string[];
  extraControls?: any;
  onGetMediaIndex: () => MediaIndex | undefined;
};

function SceneScreen({
  scene,
  onScene,
  controlPath,
  extraControls,
  onGetMediaIndex,
  sliderFields,
}: {
  scene: Scene | null | undefined;
  onScene: (update: (s: Scene) => Scene) => void;
  controlPath: string[];
  extraControls?: JSXElement | null | undefined;
  onGetMediaIndex: () => MediaIndex | undefined;
  sliderFields?: SliderFields;
}) {
  let screen = null;
  const screenProps = { onScene, controlPath, extraControls, onGetMediaIndex, sliderFields };
  if (scene?.type === 'video') {
    screen = <VideoScreen scene={scene} {...screenProps} />;
  }
  if (scene?.type === 'sequence') {
    screen = <SequenceScreen scene={scene} {...screenProps} />;
  }
  if (scene?.type === 'layers') {
    screen = <LayersScreen scene={scene} {...screenProps} />;
  }
  if (scene?.type === 'color') {
    screen = <ColorScreen scene={scene} {...screenProps} />;
  }
  if (scene?.type === 'off') {
    screen = <OffScreen scene={scene} {...screenProps} />;
  }
  if (!screen) {
    screen = <Text>Unknown Scene</Text>;
  }
  return (
    <>
      <StackScreen title={getScreenTitle(scene, controlPath)} headerBackTitle={' '} />
      {screen}
    </>
  );
}

type SceneScreenProps<SceneType> = {
  scene: SceneType;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
  extraControls?: JSXElement | null | undefined;
  onGetMediaIndex: () => MediaIndex | undefined;
  sliderFields?: SliderFields;
};

function getScreenTitle(scene: Scene | null | undefined, controlPath: string[]): string {
  if (scene?.label) return scene.label;
  if (scene?.type === 'video') return 'Video';
  if (scene?.type === 'color') return 'Color';
  if (scene?.type === 'layers') return 'Layers';
  if (scene?.type === 'sequence') return 'Sequence';
  if (scene?.type === 'off') return 'Off';
  const last = controlPath[controlPath.length - 1];
  const restPath = controlPath.slice(0, -1);
  // if (last === 'effects') return `Effects: ${getScreenTitle(restPath)}`;
  if (last === 'live') return 'Live';
  if (last === 'ready') return 'Ready';
  return '?';
}

function EffectsScreen({
  scene,
  onScene,
  controlPath,
}: {
  scene?: Scene | null;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
}) {
  if (!scene) return <SizableText>No Scene</SizableText>;
  if (scene.type !== 'video') return <SizableText>Effects only available on video scenes</SizableText>;
  return (
    <YStack flex={1}>
      <StackScreen title={`Fx: ${getScreenTitle(scene, controlPath)}`} headerBackTitle={' '} />
      <DraggableFlatList
        style={{ height: '100%' }}
        data={
          scene?.effects?.map((effect) => ({
            label: (
              <Button marginHorizontal="$4" marginVertical="$1" disabled>
                {effect.type}
              </Button>
            ),
            key: effect.key,
            onPress: navigate(`control/${controlPath.join(':')}:effect_${effect.key}`),
          })) || []
        }
        // onItemPress={(key) => {}}
        onReorder={(keyOrder) => {
          onScene((s) => ({ ...s, effects: keyOrder.map((key) => scene.effects?.find((e) => e.key === key)!) }));
        }}
        header={<View height="$2" />}
        footer={
          <YStack gap="$4" padding="$4">
            <NewEffectButton controlPath={controlPath} onScene={onScene} />
          </YStack>
        }
      />
    </YStack>
  );
}

const EffectTypes: Readonly<{ label: string; key: Effect['type'] }[]> = [
  { key: 'desaturate', label: 'Desaturate' },
  { key: 'colorize', label: 'Colorize' },
  { key: 'invert', label: 'Invert' },
  { key: 'hueShift', label: 'Hue Shift' },
  { key: 'brighten', label: 'Brighten' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'darken', label: 'Darken' },
  { key: 'rotate', label: 'Rotate' },
] as const;

function NewEffectButton({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <YStack>
          <Separator marginVertical="$4" />
          <BottomSheetTriggerButton icon={<LucideIcon icon="Sparkles" />}>New Effect</BottomSheetTriggerButton>
        </YStack>
      }
    >
      <YStack gap="$3">
        {EffectTypes.map(({ key, label }) => (
          <BottomSheetCloseButton
            key={key}
            onPress={() => {
              const newEffect = createBlankEffect(key);
              onScene((scene) => {
                if (scene.type !== 'video') return scene;
                return { ...scene, effects: [...(scene.effects || []), newEffect] };
              });
              return response(navigate(`control/${controlPath.join(':')}:effect_${newEffect.key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function EffectScreen({
  scene,
  onScene,
  controlPath,
  effectId,
  sliderFields,
}: {
  scene?: Scene | null;
  onScene: (update: (m: Scene) => Scene) => void;
  controlPath: string[];
  effectId: string;
  sliderFields?: SliderFields;
}) {
  if (!scene) return <SizableText>No Scene</SizableText>;
  if (scene.type !== 'video') return <SizableText>Effects only available on video scenes</SizableText>;
  const effect = scene.effects?.find((e) => e.key === effectId);
  let controls = null;
  function onEffect(update: (e: Effect) => Effect) {
    onScene((scene) => {
      if (scene.type !== 'video') return scene;
      return { ...scene, effects: (scene.effects || []).map((e) => (e.key === effectId ? update(e) : e)) };
    });
  }
  const effectProps = {
    onEffect,
    sliderFields,
    scenePath: controlPath.slice(0, -2),
  };
  if (effect?.type === 'brighten') {
    controls = <EffectBrightenControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'contrast') {
    controls = <EffectContrastControls effect={effect} {...effectProps} />;
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
  return (
    <YStack flex={1} padding="$4" gap="$4">
      <StackScreen title={`Fx: ${getScreenTitle(scene, controlPath)}`} headerBackTitle={' '} />
      {controls}
      <Button
        onPress={() => {
          onScene((scene) => {
            if (scene.type !== 'video') return scene;
            return { ...scene, effects: (scene.effects || []).filter((e) => e.key !== effectId) };
          });
          return response(goBack());
        }}
        icon={<LucideIcon icon="Trash" />}
      >
        Remove Effect
      </Button>
    </YStack>
  );
}

type EffectControlsProps<EffectType> = {
  effect: EffectType;
  onEffect: (update: (e: Effect) => Effect) => void;
  sliderFields?: SliderFields;
  scenePath: string[];
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

const LayerMixOptions = [
  { key: 'mix', label: 'Mix' },
  { key: 'mask', label: 'Mask' },
  { key: 'add', label: 'Add' },
] as const;

function getSliderFieldUpdater(scenePath: string[]) {
  return (update: (m: SliderFields) => SliderFields) => {
    const key = scenePath[0] === 'live' ? 'liveSliderFields' : 'readySliderFields';
    mainStateUpdate((state) => {
      return { ...state, [key]: update(state[key] || {}) };
    });
  };
}

function LayerControls({
  layersScene,
  layerKey,
  onScene,
  scenePath,
  sliderFields,
}: {
  layersScene: LayersScene;
  layerKey: string;
  onScene: (update: (m: Scene) => Scene) => void;
  scenePath: string[];
  sliderFields?: SliderFields;
}) {
  const layer = layersScene.layers?.find((layer) => layer.key === layerKey);
  if (!layer) return null;
  const blendMode = LayerMixOptions.find((o) => o.key === layer.blendMode);
  const isBaseLayer = layer === layersScene.layers?.at(-1);
  return (
    <Section title="Layer">
      {isBaseLayer ? (
        <Text>Base Layer</Text>
      ) : (
        <>
          <SelectDropdown
            options={LayerMixOptions}
            onSelect={(value) => {
              if (!value) return;
              onScene((scene) => {
                if (scene.type !== 'layers') return scene;
                return {
                  ...scene,
                  layers: scene.layers?.map((l) => (l.key === layerKey ? { ...l, blendMode: value } : l)),
                };
              });
            }}
            value={layer.blendMode}
          />
          <GradientSlider
            label={`${blendMode?.label || 'Blend'} Amount`}
            value={layer.blendAmount}
            sliderFields={sliderFields}
            scenePath={scenePath}
            fieldPath={[`layer_${layerKey}`, 'blendAmount']}
            onValueChange={(v) => {
              onScene((scene) => {
                if (scene.type !== 'layers') return scene;
                return {
                  ...scene,
                  layers: scene.layers?.map((l) => (l.key === layerKey ? { ...l, blendAmount: v } : l)),
                };
              });
            }}
          />
        </>
      )}
      <Button
        icon={<LucideIcon icon="Trash" />}
        onPress={() => {
          onScene((scene) => {
            if (scene.type !== 'layers') return scene;
            return { ...scene, layers: scene.layers?.filter((layer) => layer.key !== layerKey) };
          });
          return response(goBack());
        }}
      >
        Remove Layer
      </Button>
    </Section>
  );
}

function SqeuenceItemControls({
  sequenceScene,
  itemKey,
  onScene,
}: {
  sequenceScene: SequenceScene;
  itemKey: string;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  const item = sequenceScene.sequence?.find((item) => item.key === itemKey);
  if (!item) return null;
  return (
    <Section title="Sequence Item">
      <Button
        icon={<LucideIcon icon="Trash" />}
        onPress={() => {
          onScene((scene) => {
            if (scene.type !== 'sequence') return scene;
            return { ...scene, sequence: scene.sequence?.filter((item) => item.key !== itemKey) };
          });
          return response(goBack());
        }}
      >
        Remove Item
      </Button>
    </Section>
  );
}

function Section({ title, children }: { title?: string; children?: JSXElement }) {
  return (
    <YStack gap="$4" padding="$4">
      {title ? <Heading>{title}</Heading> : null}
      {children}
    </YStack>
  );
}

function GradientFieldDropdown({
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
  onSliderFields,
}: {
  label: string;
  sliderField: string;
  triggerButtonProps: Parameters<typeof BottomSheetTriggerButton>[0];
  onSliderFields: (update: (m: SliderFields) => SliderFields) => void;
  bounceAmount: number;
  maxBounceAmount: number;
  bounceDuration: number;
  smoothing: number;
  scenePath: string[];
  fieldPath: string[];
  step?: number;
  min?: number;
  max?: number;
  value: number;
  onValueChange: (v: number) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={<BottomSheetTriggerButton {...triggerButtonProps}>{label}</BottomSheetTriggerButton>}
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
        </Section>
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
      </SheetScrollView>
    </BottomSheet>
  );
}

function GradientSlider({
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
  scenePath: string[];
  fieldPath: string[];
}) {
  const [rootScene, ...innerScenePath] = scenePath;
  const sliderField = [...innerScenePath, ...fieldPath].join(':');
  const fieldSettings = sliderFields?.[sliderField];
  const smoothing = fieldSettings?.smoothing == null ? 0.5 : fieldSettings.smoothing;
  const maxBounceAmount = Math.abs(max - min);
  const bounceAmount = fieldSettings?.bounceAmount == null ? 1 : fieldSettings.bounceAmount;
  const bounceDuration = fieldSettings?.bounceDuration == null ? 1000 : fieldSettings.bounceDuration;
  return (
    <YStack>
      <GradientFieldDropdown
        label={label}
        sliderField={sliderField}
        onSliderFields={getSliderFieldUpdater(scenePath)}
        triggerButtonProps={{
          paddingHorizontal: 0,
          size: '$2',
          iconAfter: <LucideIcon icon="Gauge" />,
          chromeless: true,
          justifyContent: 'flex-start',
        }}
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

function SequenceScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<SequenceScene>) {
  return (
    <YStack>
      <DraggableFlatList
        style={{ height: '100%' }}
        data={
          scene?.sequence?.map((item) => ({
            label: (
              <Button
                marginHorizontal="$4"
                marginVertical="$1"
                backgroundColor={scene.activeKey === item.key ? '$green4' : undefined}
                disabled
              >
                {getScreenTitle(item.scene, [...controlPath, `item_${item.key}`])}
              </Button>
            ),
            key: item.key,
            // onPress: navigate(`control/${controlPath.join(':')}:item_${item.key}`),
          })) || []
        }
        onReorder={(keyOrder) => {
          onScene((s) => ({ ...s, sequence: keyOrder.map((key) => scene.sequence?.find((e) => e.key === key)!) }));
        }}
        onItemPress={(key) => response(navigate(`control/${controlPath.join(':')}:item_${key}`))}
        header={<View height="$2" />}
        footer={
          <YStack gap="$4" padding="$4">
            <Button
              icon={<LucideIcon icon="Play" />}
              onPress={() => {
                onScene((scene) => {
                  if (scene.type !== 'sequence') {
                    console.warn('goNext on non-sequence media');
                    return scene;
                  }
                  if (!scene.sequence.length) return scene;
                  const active = getSequenceActiveItem(scene);
                  if (!active) {
                    console.warn('goNext: active media not identified');
                    return scene;
                  }
                  const activeIndex = scene.sequence.findIndex((item) => item.key === active.key);
                  if (activeIndex === -1) {
                    console.warn('goNext: active media not found in sequence');
                    return scene;
                  }
                  const nextIndex = (activeIndex + 1) % scene.sequence.length;
                  const nextKey = scene.sequence[nextIndex]?.key;
                  if (!nextKey) {
                    console.warn('goNext: next media not identified');
                    return scene;
                  }
                  let transitionDuration = 0;
                  if (scene.transition?.duration) {
                    transitionDuration = scene.transition.duration;
                  }
                  const now = Date.now();
                  return {
                    ...scene,
                    nextActiveKey: nextKey,
                    transitionEndTime: now + transitionDuration,
                    transitionStartTime: now,
                  };
                });
              }}
            >
              Go Next
            </Button>
            <NewSequenceItem controlPath={controlPath} onScene={onScene} />
            {extraControls}
            <GenericSceneControls controlPath={controlPath} scene={scene} onScene={onScene} />
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </YStack>
        }
      />
    </YStack>
  );
}

function GenericSceneControls({
  controlPath,
  scene,
  onScene,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  const rootScene = controlPath[0];
  const labelId = `label-${controlPath.join(':')}`;
  return (
    <>
      {/* <BottomSheet
        trigger={<BottomSheetTriggerButton icon={<LucideIcon icon="Tag" />}>Rename Scene</BottomSheetTriggerButton>}
      > */}
      <YStack flex={1}>
        <RiseForm
          onSubmit={(fields) => {
            onScene((s) => ({ ...s, label: fields[labelId] }));
          }}
        >
          <InputField label="Scene Name" id={labelId} defaultValue={scene.label} />
          <SubmitButton>Save Label</SubmitButton>
        </RiseForm>
      </YStack>
      {/* </BottomSheet> */}
      <Button
        icon={<LucideIcon icon="Download" />}
        onPress={async () => {
          console.log('Write Library Item', controlPath, scene);
          await writeLibraryItem(controlPath, scene);
          return response(toast('Saved to Library'));
        }}
      >
        Save to Library
      </Button>
      <Button icon={<LucideIcon icon="LayoutDashboard" />} onPress={navigate(`dashboard/${rootScene}`)}>
        {rootScene === 'live' ? 'Live Dashboard' : 'Ready Dashboard'}
      </Button>
    </>
  );
}

function ColorScreen({ scene, onScene, controlPath, extraControls, sliderFields }: SceneScreenProps<ColorScene>) {
  return (
    <ScrollView>
      <YStack gap="$4" padding="$4">
        <GradientSlider
          label={`Hue`}
          value={scene.h}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['h']}
          max={360}
          step={1}
          onValueChange={(v) => onScene((s) => ({ ...s, h: v }))}
        />
        <GradientSlider
          label={`Saturation`}
          value={scene.s}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['s']}
          onValueChange={(v) => onScene((s) => ({ ...s, s: v }))}
        />
        <GradientSlider
          label={`Brightness`}
          value={scene.l}
          sliderFields={sliderFields}
          scenePath={controlPath}
          fieldPath={['h']}
          onValueChange={(v) => onScene((s) => ({ ...s, l: v }))}
        />

        {extraControls}
        <GenericSceneControls controlPath={controlPath} scene={scene} onScene={onScene} />
        <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
      </YStack>
    </ScrollView>
  );
}

function OffScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<OffScene>) {
  return (
    <ScrollView>
      <YStack gap="$4" padding="$4">
        {extraControls}
        <GenericSceneControls controlPath={controlPath} scene={scene} onScene={onScene} />
        <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
      </YStack>
    </ScrollView>
  );
}

function iconOfBlendMode(blendMode: 'add' | 'mix' | 'mask') {
  if (blendMode === 'add') return <LucideIcon icon="PlusCircle" />;
  if (blendMode === 'mix') return <LucideIcon icon="Blend" />;
  if (blendMode === 'mask') return <LucideIcon icon="Eclipse" />;
  return <LucideIcon icon="Blend" />;
}

function LayersScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<LayersScene>) {
  return (
    <YStack>
      <DraggableFlatList
        style={{ height: '100%' }}
        data={
          scene.layers?.map((layer) => {
            const isBaseLayer = layer === scene.layers?.at(-1);
            return {
              label: (
                <Button
                  marginHorizontal="$4"
                  marginVertical="$1"
                  disabled
                  icon={isBaseLayer ? null : iconOfBlendMode(layer.blendMode)}
                >
                  {getScreenTitle(layer.scene, [...controlPath, `layer_${layer.key}`])}
                </Button>
              ),
              key: layer.key,
              // onPress: navigate(`control/${controlPath.join(':')}:layer_${layer.key}`),
            };
          }) || []
        }
        onReorder={(keyOrder) => {
          onScene((s) => ({ ...s, layers: keyOrder.map((key) => scene.layers?.find((e) => e.key === key)!) }));
        }}
        onItemPress={(key) => response(navigate(`control/${controlPath.join(':')}:layer_${key}`))}
        header={<View height="$2" />}
        footer={
          <YStack gap="$4" padding="$4">
            <NewLayerButton controlPath={controlPath} onScene={onScene} />
            {extraControls}
            <GenericSceneControls controlPath={controlPath} scene={scene} onScene={onScene} />
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </YStack>
        }
      />
    </YStack>
  );
}

function NewLayerButton({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={<BottomSheetTriggerButton icon={<LucideIcon icon="PlusCircle" />}>New Layer</BottomSheetTriggerButton>}
    >
      {ref('add_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );

  return (
    <BottomSheet
      trigger={
        <YStack>
          <Separator marginVertical="$4" />
          return (
          {/* <BottomSheetTriggerButton icon={<LucideIcon icon="PlusCircle" />}>New Layer</BottomSheetTriggerButton> */}
        </YStack>
      }
    >
      <YStack gap="$3">
        {SceneTypes.map(({ key, label }) => (
          <BottomSheetCloseButton
            onPress={() => {
              const newLayer: Layer = {
                scene: createBlankScene(key),
                key: randomUUID(),
                blendMode: 'mix',
                blendAmount: 0,
              };
              onScene((scene) => {
                if (scene.type !== 'layers') return scene;
                return { ...scene, layers: [newLayer, ...(scene.layers || [])] };
              });
              return response(navigate(`control/${controlPath.join(':')}:layer_${newLayer.key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function NewSequenceItem({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton icon={<LucideIcon icon="PlusCircle" />}>New Sequence Scene</BottomSheetTriggerButton>
      }
    >
      {ref('add_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
  return (
    <BottomSheet
      trigger={
        <YStack>
          <Separator marginVertical="$4" />
          <BottomSheetTriggerButton icon={<LucideIcon icon="PlusCircle" />}>Add to Sequence</BottomSheetTriggerButton>
        </YStack>
      }
    >
      <YStack gap="$3">
        {SceneTypes.map(({ key, label }) => (
          <BottomSheetCloseButton
            onPress={() => {
              const newLayer: SequenceItem = {
                scene: createBlankScene(key),
                key: randomUUID(),
              };
              onScene((scene) => {
                if (scene.type !== 'sequence') return scene;
                return { ...scene, sequence: [...(scene.sequence || []), newLayer] };
              });
              return response(navigate(`control/${controlPath.join(':')}:item_${newLayer.key}`));
            }}
          >
            {label}
          </BottomSheetCloseButton>
        ))}
      </YStack>
    </BottomSheet>
  );
}

function EffectsButton({ controlPath }: { controlPath: string[] }) {
  return (
    <Button onPress={navigate(`control/${controlPath.join(':')}:effects`)} icon={<LucideIcon icon="Sparkles" />}>
      Effects
    </Button>
  );
}

function ResetSceneButton({
  controlPath,
  scene,
  onScene,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton icon={<LucideIcon icon="UndoDot" />} theme="red">
          Reset Scene
        </BottomSheetTriggerButton>
      }
    >
      {ref('reset_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );

  return (
    <SelectDropdown
      value={scene?.type || 'off'}
      options={SceneTypes}
      triggerProps={{ theme: 'red', icon: <LucideIcon icon="UndoDot" /> }}
      triggerLabel="Reset Scene"
      onSelect={(key) => {
        onScene(() => createBlankScene(key));
      }}
    />
  );
}

function VideoScreen({ scene, onScene, controlPath, onGetMediaIndex, extraControls }: SceneScreenProps<VideoScene>) {
  const index = onGetMediaIndex();
  const trackOptions = index?.files.map((file) => ({ key: file.id, label: file.title }));
  return (
    <ScrollView>
      <YStack marginVertical="$4" marginHorizontal="$4" gap="$4">
        {scene?.track ? (
          <XStack gap="$2">
            <Button
              flex={1}
              onPress={navigate(`browse_videos/${scene.track}`)}
              iconAfter={<LucideIcon icon="ChevronRight" />}
            >
              {index?.files.find((file) => file.id === scene.track)?.title || scene.track}
            </Button>
            {trackOptions && (
              <SelectDropdown
                triggerLabel=""
                triggerProps={{ icon: <LucideIcon icon="Library" />, chromeless: true }}
                value={scene?.track}
                options={trackOptions}
                onSelect={(key) => {
                  onScene(() => ({
                    ...scene,
                    track: key,
                    label: index?.files.find((f) => f.id === key)?.title || '?',
                  }));
                }}
              />
            )}
          </XStack>
        ) : index?.files ? (
          trackOptions && (
            <SelectDropdown
              emptyLabel="Select a video track"
              value={scene?.track}
              options={trackOptions}
              onSelect={(key) => {
                onScene(() => ({ ...scene, track: key, label: index.files.find((f) => f.id === key)?.title }));
              }}
            />
          )
        ) : (
          <Spinner />
        )}
        <Button
          onPress={() => {
            const player = mainVideo.getPlayer(scene.id);
            player?.restart();
          }}
        >
          Restart Video
        </Button>
        {/* <Text>{JSON.stringify(scene)}</Text> */}
        {/* <Text>{JSON.stringify(index?.files)}</Text> */}
        <EffectsButton controlPath={controlPath} />
      </YStack>
      {extraControls}
      <Separator marginBottom="$4" />
      <YStack marginHorizontal="$4" gap="$4">
        <GenericSceneControls controlPath={controlPath} scene={scene} onScene={onScene} />
        <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
      </YStack>
    </ScrollView>
  );
}

function SelectDropdown<Options extends Readonly<{ label: string; key: string }[]>>({
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
      trigger={
        <BottomSheetTriggerButton iconAfter={<LucideIcon icon="ChevronDown" />} {...triggerProps}>
          {triggerLabel ?? options.find((o) => o.key === value)?.label ?? emptyLabel}
        </BottomSheetTriggerButton>
      }
    >
      <SheetScrollView>
        <YStack>
          {options.map((option) => (
            <BottomSheetCloseButton
              key={option.key}
              onPress={() => {
                onSelect(option.key);
              }}
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
        <SmoothSlider
          value={transition.duration}
          min={0}
          step={10}
          max={15_000}
          smoothing={0.5}
          onValueChange={(v) => onTransition((t) => ({ ...t, duration: v }))}
          size={50}
        />
      </YStack>
    </BottomSheet>
  );
}
