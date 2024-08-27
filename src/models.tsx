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
  Switch,
  SwitchThumb,
  Text,
  toast,
  ToggleGroup,
  ToggleGroupItem,
  View,
  XStack,
  YStack,
} from '@rise-tools/kitchen-sink/server';
import { execFileSync } from 'child_process';
import { ActionModelState, createComponentDefinition, ref, response } from '@rise-tools/react';
import { lookup, view } from '@rise-tools/server';
import { createComponentDefinition, ref, response } from '@rise-tools/react';
import { lookup, ValueModel, view } from '@rise-tools/server';
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
  getSceneEffects,
  goNext,
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
  DefaultTransition,
  DesaturateEffect,
  Effect,
  HueShiftEffect,
  Layer,
  LayersScene,
  MainState,
  OffScene,
  PrismEffect,
  RotateEffect,
  Scene,
  SequenceItem,
  SequenceScene,
  SliderFields,
  Transition,
  TransitionState,
  VideoScene,
} from './state-schema';
import { DefaultBounceAmount, DefaultBounceDuration, DefaultSmoothing, DefaultTransitionDuration } from './constants';
import { compare } from 'fast-json-patch';
// import { isEqual } from 'lodash';
type JSXElement = ReturnType<ReturnType<typeof createComponentDefinition>>;

function isEqual(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compareView<V>(loader: (get: <V>(model: ValueModel<V>) => V | undefined) => V) {
  return view<V>(loader, { compare: isEqual });
}

export const models = {
  home: compareView((get) => {
    const state = get(mainState);
    if (!state) return <Spinner />;
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
        <Text marginVertical="$6" textAlign="center">
          Powering the Entheos Empyrean Gate @ Burning Man 2024
        </Text>
        <Text marginVertical="$6" textAlign="center">
          With ❤️ from Cosmic
        </Text>
      </NarrowScrollView>
    );
  }),
  admin: () => (
    <NarrowScrollView>
      <StackScreen title="Administration" />
      <Section title="Data">
        <Button
          icon={<LucideIcon icon="FolderSync" />}
          onPress={() => {
            libraryIndex.invalidate();
          }}
        >
          Reload Scene Library
        </Button>
        <Button
          icon={<LucideIcon icon="FolderSync" />}
          onPress={() => {
            mediaIndex.invalidate();
          }}
        >
          Reload Media Index
        </Button>
      </Section>
      <Section title="Danger">
        <Button
          theme="red"
          icon={<LucideIcon icon="ServerCrash" />}
          onPress={() => {
            execFileSync('pm2', ['restart', 'eclipse']);
          }}
        >
          Restart Server
        </Button>
      </Section>
    </NarrowScrollView>
  ),
  dashboard: lookup((dashboardKey) => {
    const dashboard = dashboards.get(dashboardKey);
    return compareView((get) => {
      const dashboardState = dashboard ? get(dashboard) : undefined;
      if (dashboardKey !== 'live' && dashboardKey !== 'ready') return <Text>Unknown Dashboard</Text>;
      return <DashboardScreen dashboardKey={dashboardKey} dashboard={dashboardState} />;
    });
  }),
  dashboard_edit: lookup((dashboardKey) => {
    const dashboard = dashboards.get(dashboardKey);
    return compareView((get) => {
      const dashboardState = dashboard ? get(dashboard) : undefined;
      if (dashboardKey !== 'live' && dashboardKey !== 'ready') return <Text>Unknown Dashboard</Text>;
      return <EditDashboardScreen dashboardKey={dashboardKey} dashboard={dashboardState} />;
    });
  }),
  dashboard_edit_item: lookup((dashboardKey) => {
    return lookup((itemKey) => {
      return compareView((get) => {
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
    compareView((get) => {
      const media = get(mediaIndex);
      if (fileId !== '') return <MediaFileScreen file={media?.files.find((file) => file.id === fileId)} />;
      const importing = get(importState);

      return <BrowseMediaScreen media={media} importing={importing} />;
    })
  ),
  browse_library: lookup((libraryId) =>
    compareView((get) => {
      if (libraryId !== '') return <LibraryItemScreen item={libraryId} />;
      const lib = get(libraryIndex);
      return (
        <ScrollView>
          <StackScreen title="Scene Library" />
          <YStack padding="$4">
            <ButtonGroup
              items={
                lib?.map((file) => ({
                  key: file,
                  label: file,
                  onPress: navigate(`browse_library/${file}`),
                })) || []
              }
            />
          </YStack>
        </ScrollView>
      );
    })
  ),
  reset_scene: lookup((scenePathStr) =>
    compareView((get) => {
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
      return <NewScenePicker behaviorLabel="Reset to" onScene={onScene} library={lib} media={media} />;
    })
  ),
  reorder_sequence: lookup((scenePath) =>
    view((get) => {
      const sceneModel = sceneState.get(scenePath);
      const scene = sceneModel ? get(sceneModel) : undefined;
      if (!scene || scene.type !== 'sequence') return <Text>Not a sequence Scene</Text>;
      return (
        <>
          <StackScreen title={`${getScreenTitle(scene, scenePath.split(':'))} Order`} headerBackTitle={' '} />
          <DraggableFlatList
            style={{ height: '100%' }}
            header={<View height="$2" />}
            footer={<View height="$4" />}
            data={(scene.sequence || []).map((item) => ({
              key: item.key,
              label: (
                <DraggableItem>
                  {getScreenTitle(item.scene, [...scenePath.split(':'), `item_${item.key}`])}
                </DraggableItem>
              ),
            }))}
            onReorder={(newSequence) => {
              updateScene(scenePath.split(':'), (scene) => {
                if (scene.type !== 'sequence') return scene;
                return { ...scene, sequence: newSequence.map((key) => scene.sequence.find((l) => l.key === key)!) };
              });
            }}
          />
        </>
      );
    })
  ),
  reorder_layers: lookup((scenePath) =>
    view((get) => {
      const sceneModel = sceneState.get(scenePath);
      const scene = sceneModel ? get(sceneModel) : undefined;
      if (!scene || scene.type !== 'layers') return <Text>Not a Layers Scene</Text>;
      return (
        <>
          <StackScreen title={`${getScreenTitle(scene, scenePath.split(':'))} Order`} headerBackTitle={' '} />
          <DraggableFlatList
            style={{ height: '100%' }}
            header={<View height="$2" />}
            footer={<View height="$4" />}
            data={(scene.layers || []).map((layer) => ({
              key: layer.key,
              label: (
                <DraggableItem>
                  {getScreenTitle(layer.scene, [...scenePath.split(':'), `layer_${layer.key}`])}
                </DraggableItem>
              ),
            }))}
            onReorder={(newLayers) => {
              updateScene(scenePath.split(':'), (scene) => {
                if (scene.type !== 'layers') return scene;
                return { ...scene, layers: newLayers.map((key) => scene.layers.find((l) => l.key === key)!) };
              });
            }}
          />
        </>
      );
    })
  ),
  reorder_effects: lookup((scenePath) =>
    view((get) => {
      const sceneModel = sceneState.get(scenePath);
      const scene = sceneModel ? get(sceneModel) : undefined;
      if (!scene) return <Text>Not a Scene</Text>;
      return (
        <>
          <StackScreen title={`Effects Order`} headerBackTitle={' '} />
          <DraggableFlatList
            style={{ height: '100%' }}
            header={<View height="$2" />}
            footer={<View height="$4" />}
            data={(getSceneEffects(scene) || []).map((effect) => ({
              key: effect.key,
              label: <DraggableItem>{effect.type}</DraggableItem>,
            }))}
            onReorder={(newEffectOrder) => {
              updateScene(scenePath.split(':'), (scene) => {
                return {
                  ...scene,
                  effects: newEffectOrder.map((key) => getSceneEffects(scene)!.find((l) => l.key === key)!),
                };
              });
            }}
          />
        </>
      );
    })
  ),
  add_scene: lookup((scenePath) =>
    compareView((get) => {
      const lib = get(libraryIndex);
      const media = get(mediaIndex);

      return (
        <NewScenePicker
          behaviorLabel="Add"
          library={lib}
          media={media}
          onScene={(newChildScene) => {
            const key = randomUUID();
            let navigatePath = '';
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
                  maxDuration: null,
                  goNextOnEnd: false,
                  goNextAfterLoops: 1,
                };
                navigatePath = `${scenePath}:item_${key}`;
                return {
                  ...scene,
                  sequence: [...(scene.sequence || []), newItem],
                  ...(scene.activeKey ? {} : { activeKey: key, transitionEndTime: Date.now() }),
                };
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
  global_effects: lookup((effectKey) => {
    if (effectKey) {
      return compareView((get) => {
        const state = get(mainState);
        if (!state) return <Spinner />;
        const effect = state.effects?.find((e) => e.key === effectKey);
        if (!effect) return <Text>No Effect</Text>;
        return (
          <EffectScreen
            effect={effect}
            onEffect={(updater) => {
              mainStateUpdate((state) => {
                return {
                  ...state,
                  effects: state.effects?.map((e) => (e.key === effectKey ? updater(e) : e)),
                };
              });
            }}
            onRemove={() => {
              mainStateUpdate((state) => {
                return {
                  ...state,
                  effects: state.effects?.filter((e) => e.key !== effectKey),
                };
              });
              return response(goBack());
            }}
          />
        );
      });
    }
    return compareView((get) => {
      const state = get(mainState);
      if (!state) return <Spinner />;
      return (
        <GlobalEffectsScreen
          effects={state.effects}
          onEffects={(updater) => {
            mainStateUpdate((state) => ({
              ...state,
              effects: updater(state.effects),
            }));
          }}
        />
      );
    });
  }),
  control: lookup((controlPath) => {
    console.log('control', controlPath);
    const path = controlPath.split(':');
    const { scenePath, restPath } = unpackControlPath(path);
    const scene = sceneState.get(scenePath.join(':'));
    const sliderFieldsModel = sliderFields.get(path[0]);
    if (restPath[0] === 'effects') {
      if (restPath[1]) {
        const effectId = restPath[1].split('_')[1];
        return compareView((get) => {
          const sceneState = scene ? get(scene) : null;
          if (!sceneState) return <SizableText>No Scene</SizableText>;
          const effect = getSceneEffects(sceneState)?.find((e) => e.key === effectId);
          if (!effect) return <SizableText>No Effect</SizableText>;
          return (
            <EffectScreen
              effect={effect}
              controlPath={path}
              onEffect={(update: (e: Effect) => Effect) => {
                updateScene(scenePath, (scene) => {
                  return {
                    ...scene,
                    effects: (getSceneEffects(scene) || []).map((e) => (e.key === effectId ? update(e) : e)),
                  };
                });
              }}
              sliderFields={sliderFieldsModel ? get(sliderFieldsModel) : undefined}
              onRemove={() => {
                updateScene(scenePath, (scene) => {
                  return { ...scene, effects: (getSceneEffects(scene) || []).filter((e) => e.key !== effectId) };
                });
                return response(goBack());
              }}
            />
          );
        });
      }
      return compareView((get) => {
        return (
          <EffectsScreen
            scene={scene ? get(scene) : null}
            onScene={(updater) => {
              updateScene(scenePath, updater);
            }}
            controlPath={path}
          />
        );
      });
    }
    if (restPath.length) {
      return () => <Text>Unrecognized Control Path</Text>;
    }
    return compareView((get) => {
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
    });
  }),
};

function LibraryItemScreen({ item }: { item: string }) {
  return (
    <NarrowScrollView>
      <StackScreen title={item} />
      <YStack padding="$4" gap="$4">
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
      </YStack>
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
      <YStack padding="$4">
        <Button
          onPress={async () => {
            await deleteLibraryItem(item);
            return response(goBack());
          }}
        >
          Delete from Library
        </Button>
      </YStack>
    </NarrowScrollView>
  );
}

function DraggableItem({ children }: { children?: JSXElement }) {
  return (
    <View
      marginHorizontal="$4"
      paddingHorizontal="$4"
      paddingVertical="$3"
      backgroundColor="$color3"
      borderRadius="$4"
      marginVertical="$1"
    >
      <Text>{children}</Text>
    </View>
  );
}

function ButtonGroup({
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

function NewScenePicker({
  onScene,
  media,
  library,
  behaviorLabel,
}: {
  onScene: (scene: Scene, other?: { dashboard?: Dashboard; sliderFields?: SliderFields }) => void;
  media: MediaIndex | undefined;
  library?: string[];
  behaviorLabel: string;
}) {
  return (
    <SheetScrollView>
      <YStack>
        <Section title={`${behaviorLabel} Video`}>
          <ButtonGroup
            Button={BottomSheetCloseButton}
            items={media?.files?.map((file) => ({
              key: file.id,
              label: file.title,
              onPress: () => {
                return onScene({
                  type: 'video',
                  id: randomUUID(),
                  track: file.id,
                  label: file.title,
                });
              },
            }))}
          />
        </Section>
        <Section title={`${behaviorLabel} Library Scene`}>
          <ButtonGroup
            Button={BottomSheetCloseButton}
            items={library?.map((libraryItem) => ({
              key: libraryItem,
              label: libraryItem,
              onPress: async () => {
                const item = await getLibraryItem(libraryItem);
                return onScene(item.scene, { dashboard: item.dashboard, sliderFields: item.sliderFields });
              },
            }))}
          />
        </Section>
        <Section title={`${behaviorLabel} New Scene`}>
          <ButtonGroup
            Button={BottomSheetCloseButton}
            items={SceneTypes.map(({ key, label }) => ({
              key,
              label,
              onPress: () => {
                return onScene(createBlankScene(key));
              },
            }))}
          />
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
    <NarrowScrollView>
      <StackScreen title="Media Library" />
      <YStack gap="$1" padding="$4">
        <ButtonGroup
          items={
            media?.files?.map((file) => ({
              key: file.id,
              label: file.title,
              onPress: navigate(`browse_videos/${file.id}`),
            })) || []
          }
        />
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
    </NarrowScrollView>
  );
}

function MediaFileScreen({ file }: { file: MediaFile | undefined }) {
  if (!file) return <SizableText>No File</SizableText>;
  return (
    <NarrowScrollView>
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
    </NarrowScrollView>
  );
}

function DashboardScreen({ dashboard, dashboardKey }: { dashboardKey: string; dashboard?: DashboardState }) {
  const title = dashboardKey === 'live' ? 'Live Dashboard' : 'Ready Dashboard';
  return (
    <NarrowScrollView>
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
    </NarrowScrollView>
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
    <NarrowScrollView>
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
    </NarrowScrollView>
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

const SceneTypes = [
  { key: 'off', label: 'Off' },
  { key: 'color', label: 'Color' },
  { key: 'video', label: 'Video' },
  { key: 'layers', label: 'Layers' },
  { key: 'sequence', label: 'Sequence' },
] as const;

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
  const effects = getSceneEffects(scene);
  return (
    <NarrowScrollView>
      <StackScreen title={`Fx: ${getScreenTitle(scene, controlPath)}`} headerBackTitle={' '} />
      <Section title="Effect Order">
        {effects?.map((effect) => (
          <Button onPress={navigate(`control/${controlPath.join(':')}:effect_${effect.key}`)} key={effect.key}>
            {effect.type}
          </Button>
        ))}
        {effects?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            No Effects Yet
          </Text>
        ) : null}
        <XStack gap="$4" padding="$4">
          <NewEffectButton
            getFollowupPath={(key) => `control/${controlPath.join(':')}:effect_${key}`}
            onEffects={(updater) =>
              onScene((s) => ({
                ...s,
                effects: updater(getSceneEffects(s)),
              }))
            }
          />
          <Button
            chromeless
            onPress={navigate(`reorder_effects/${controlPath.slice(0, -1).join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Effect Order
          </Button>
        </XStack>
      </Section>
    </NarrowScrollView>
  );
}

function GlobalEffectsScreen({
  effects,
  onEffects,
}: {
  effects?: Effect[];
  onEffects: (update: (m?: Effect[]) => Effect[]) => void;
}) {
  return (
    <NarrowScrollView>
      <StackScreen title={`Global Fx`} headerBackTitle={' '} />
      {effects?.map((effect) => (
        <Button
          key={effect.key}
          onPress={navigate(`global_effects/${effect.key}`)}
          marginHorizontal="$4"
          marginVertical="$1"
          disabled
        >
          {effect.type}
        </Button>
      ))}
      <YStack gap="$4" padding="$4">
        <NewEffectButton getFollowupPath={(key) => `global_effects/${key}`} onEffects={onEffects} />
      </YStack>
    </NarrowScrollView>
  );
}

const EffectTypes: Readonly<{ label: string; key: Effect['type'] }[]> = [
  { key: 'desaturate', label: 'Desaturate' },
  { key: 'colorize', label: 'Colorize' },
  { key: 'invert', label: 'Invert' },
  { key: 'hueShift', label: 'Hue Shift' },
  { key: 'brighten', label: 'Brighten' },
  { key: 'prism', label: 'Prism' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'darken', label: 'Darken' },
  { key: 'rotate', label: 'Rotate' },
] as const;

function NewEffectButton({
  getFollowupPath,
  onEffects,
}: {
  getFollowupPath: (key: string) => string;
  onEffects: (update: (m?: Effect[]) => Effect[]) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Sparkles" />}>
          Add Effect
        </BottomSheetTriggerButton>
      }
    >
      <Section title="Add Effect">
        <ButtonGroup
          Button={BottomSheetCloseButton}
          items={EffectTypes.map(({ key, label }) => ({
            key,
            label,
            onPress: () => {
              const newEffect = createBlankEffect(key);
              onEffects((effects) => {
                return [...(effects || []), newEffect];
              });
              return response(navigate(getFollowupPath(newEffect.key)));
            },
          }))}
        />
      </Section>
    </BottomSheet>
  );
}

function EffectScreen({
  controlPath,
  sliderFields,
  effect,
  onEffect,
  onRemove,
}: {
  controlPath?: string[];
  sliderFields?: SliderFields;
  effect: Effect;
  onEffect: (update: (e: Effect) => Effect) => void;
  onRemove: () => void;
}) {
  const effectProps = {
    onEffect,
    sliderFields,
    scenePath: controlPath?.slice(0, -2),
  };
  let controls = null;
  if (effect?.type === 'brighten') {
    controls = <EffectBrightenControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'contrast') {
    controls = <EffectContrastControls effect={effect} {...effectProps} />;
  }
  if (effect?.type === 'prism') {
    controls = <EffectPrismControls effect={effect} {...effectProps} />;
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
    <NarrowScrollView>
      <YStack flex={1} padding="$4" gap="$4">
        {/* <StackScreen title={`Fx: ${getScreenTitle(scene, controlPath)}`} headerBackTitle={' '} /> */}
        {controls}
        <XStack gap="$4">
          <Button theme="red" marginTop="$5" onPress={onRemove} icon={<LucideIcon icon="Trash" />}>
            Remove Effect
          </Button>
        </XStack>
      </YStack>
    </NarrowScrollView>
  );
}

type EffectControlsProps<EffectType> = {
  effect: EffectType;
  onEffect: (update: (e: Effect) => Effect) => void;
  sliderFields?: SliderFields;
  scenePath?: string[];
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

function SwitchField({
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

function NumericField({
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

function EffectPrismControls({ effect, onEffect, sliderFields, scenePath }: EffectControlsProps<PrismEffect>) {
  return (
    <YStack gap="$2">
      <GradientSlider
        label="Slice Count"
        value={effect.slices}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'slices']}
        step={1}
        min={1}
        max={16}
        onValueChange={(v) => onEffect((e) => ({ ...e, slices: v }))}
        sliderFields={sliderFields}
      />
      <SwitchField label="Mirror" value={effect.mirror} onValueChange={(v) => onEffect((e) => ({ ...e, mirror: v }))} />
      <GradientSlider
        label="Offset Input Slice"
        value={effect.offset}
        scenePath={scenePath}
        fieldPath={['effects', `effect_${effect.key}`, 'offset']}
        onValueChange={(v) => onEffect((e) => ({ ...e, offset: v }))}
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
  function onItem(update: (i: SequenceItem) => SequenceItem) {
    onScene((scene) => {
      if (scene.type !== 'sequence') return scene;
      return {
        ...scene,
        sequence: scene.sequence?.map((i) => (i.key === itemKey ? update(i) : i)),
      };
    });
  }
  return (
    <Section title="Sequence Item">
      <Button
        theme="green"
        icon={<LucideIcon icon="PlayCircle" />}
        onPress={() => {
          onScene((scene) => {
            if (scene.type !== 'sequence') return scene;
            if (scene.activeKey === itemKey) return scene;
            if (!scene.sequence.length) return scene;
            let transitionDuration = 0;
            if (scene.transition?.duration) {
              transitionDuration = scene.transition.duration;
            }
            const now = Date.now();
            return {
              ...scene,
              nextActiveKey: itemKey,
              transitionEndTime: now + transitionDuration,
              transitionStartTime: now,
            };
          });
        }}
      >
        Play
      </Button>
      {item.scene.type === 'video' ? (
        <SwitchField
          label="Go Next on End"
          value={item.goNextOnEnd || false}
          onValueChange={(goNextOnEnd) => {
            onItem((i) => ({ ...i, goNextOnEnd }));
          }}
        />
      ) : null}
      {/* {item.goNextOnEnd ? (
        <NumericField
          label="Go Next After Loop Count"
          value={item.goNextAfterLoops ?? 1}
          onValueChange={(goNextAfterLoops) => {
            onItem((i) => ({ ...i, goNextAfterLoops }));
          }}
          min={1}
          max={20}
        />
      ) : null} */}
      <SwitchField
        label="Go Next on Duration"
        value={item.maxDuration != null}
        onValueChange={(maxDuration) => {
          if (maxDuration) onItem((i) => ({ ...i, maxDuration: 10 }));
          else onItem((i) => ({ ...i, maxDuration: null }));
        }}
      />
      {item.maxDuration ? (
        <NumericField
          label="Go Next After Duration"
          value={item.maxDuration ?? 1}
          onValueChange={(maxDuration) => {
            onItem((i) => ({ ...i, maxDuration }));
          }}
          min={1}
          max={120}
          unit="sec"
        />
      ) : null}
      <XStack gap="$4">
        <Button
          theme="red"
          icon={<LucideIcon icon="Trash" />}
          onPress={() => {
            onScene((scene) => {
              if (scene.type !== 'sequence') return scene;
              const newScene = { ...scene, sequence: scene.sequence?.filter((i) => i.key !== itemKey) };
              if (scene.activeKey === itemKey) {
                newScene.activeKey = newScene.sequence?.[0]?.key;
                newScene.nextActiveKey = undefined;
                newScene.transitionStartTime = undefined;
                newScene.transitionEndTime = Date.now();
              } else if (scene.nextActiveKey === itemKey) {
                newScene.nextActiveKey = undefined;
                newScene.transitionStartTime = undefined;
                newScene.transitionEndTime = Date.now();
              }
              return newScene;
            });
            return response(goBack());
          }}
        >
          Remove Item
        </Button>
      </XStack>
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

function SequenceScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<SequenceScene>) {
  const activeItemKey = scene.activeKey || scene.sequence[0]?.key;
  const nextItemKey = scene.nextActiveKey;
  function bgColorOfItem(item: SequenceItem) {
    if (item.key === activeItemKey) return '$green4';
    if (item.key === nextItemKey) return '$yellow4';
    return undefined;
  }
  return (
    <NarrowScrollView>
      <Section title="Sequence Order">
        {scene.sequence?.map((item) => (
          <Button
            key={item.key}
            backgroundColor={bgColorOfItem(item)}
            onPress={() => {
              return response(navigate(`control/${controlPath.join(':')}:item_${item.key}`));
            }}
          >
            {getScreenTitle(item.scene, [...controlPath, `item_${item.key}`])}
          </Button>
        ))}
        {scene.sequence?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            Empty Sequence Yet
          </Text>
        ) : null}

        <XStack gap="$4">
          <NewSequenceItem controlPath={controlPath} onScene={onScene} />
          <Button
            chromeless
            onPress={navigate(`reorder_sequence/${controlPath.join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Reorder Sequence
          </Button>
        </XStack>
      </Section>
      <Section title="Sequence Controls">
        <XStack gap="$4">
          <Button
            theme="green"
            icon={<LucideIcon icon="Play" />}
            onPress={() => {
              goNext(controlPath);
            }}
          >
            Play Next
          </Button>
          <SetTransitionButton scene={scene} onScene={onScene} />
        </XStack>
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

function SetTransitionButton({
  scene,
  onScene,
}: {
  scene: SequenceScene;
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Presentation" />}>
          Set Transition
        </BottomSheetTriggerButton>
      }
    >
      <EditTransitionForm
        transition={scene.transition ?? DefaultTransition}
        onTransition={(updater) =>
          onScene((s) => {
            if (s.type !== 'sequence') return s;
            return { ...s, transition: updater(s.transition ?? DefaultTransition) };
          })
        }
      />
    </BottomSheet>
  );
}

function EditTransitionForm({
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

let debugLast = {};
function GenericSceneSection({
  controlPath,
  scene,
  onScene,
  children,
}: {
  controlPath: string[];
  scene: Scene;
  onScene: (update: (m: Scene) => Scene) => void;
  children?: JSXElement;
}) {
  // const last = debugLast[controlPath.join(':')];
  // if (last) {
  //   console.log(controlPath, compare(last, scene));
  // }
  // debugLast[controlPath.join(':')] = scene;
  // console.log('label!', controlPath);
  const rootScene = controlPath[0];
  const labelId = `label-${controlPath.join(':')}`;
  return (
    <>
      <Section title="Scene Options">
        <XStack gap="$4">
          <BottomSheet
            trigger={
              <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="Tag" />}>
                Rename Scene
              </BottomSheetTriggerButton>
            }
          >
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
          </BottomSheet>
          <Button
            chromeless
            icon={<LucideIcon icon="Download" />}
            onPress={async () => {
              console.log('Write Library Item', controlPath, scene);
              await writeLibraryItem(controlPath, scene);
              return response(toast('Saved to Library'));
            }}
          >
            Save to Library
          </Button>
        </XStack>
        {children}
      </Section>
      <Section title="Main Scene Dashboard">
        <XStack>
          <Button
            marginTop="$4"
            icon={<LucideIcon icon="LayoutDashboard" />}
            onPress={navigate(`dashboard/${rootScene}`)}
          >
            {rootScene === 'live' ? 'Live Dashboard' : 'Ready Dashboard'}
          </Button>
        </XStack>
      </Section>
    </>
  );
}

function ColorScreen({ scene, onScene, controlPath, extraControls, sliderFields }: SceneScreenProps<ColorScene>) {
  return (
    <NarrowScrollView>
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
        <GenericSceneSection controlPath={controlPath} scene={scene} onScene={onScene}>
          <XStack gap="$4">
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </XStack>
        </GenericSceneSection>
      </YStack>
    </NarrowScrollView>
  );
}

function OffScreen({ scene, onScene, controlPath, extraControls }: SceneScreenProps<OffScene>) {
  return (
    <NarrowScrollView>
      <YStack gap="$4" padding="$4">
        {extraControls}
        <GenericSceneSection controlPath={controlPath} scene={scene} onScene={onScene}>
          <XStack gap="$4">
            <ResetSceneButton controlPath={controlPath} scene={scene} onScene={onScene} />
          </XStack>
        </GenericSceneSection>
      </YStack>
    </NarrowScrollView>
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
    <NarrowScrollView>
      <Section title="Layers">
        {scene.layers?.map((layer) => {
          const isBaseLayer = layer === scene.layers?.at(-1);
          return (
            <Button
              key={layer.key}
              icon={isBaseLayer ? null : iconOfBlendMode(layer.blendMode)}
              onPress={navigate(`control/${controlPath.join(':')}:layer_${layer.key}`)}
            >
              {getScreenTitle(layer.scene, [...controlPath, `layer_${layer.key}`])}
            </Button>
          );
        })}
        {scene.layers?.length === 0 ? (
          <Text color="$color9" marginVertical="$6">
            No Layers Yet
          </Text>
        ) : null}
        <XStack gap="$4">
          <NewLayerButton controlPath={controlPath} onScene={onScene} />
          <Button
            chromeless
            onPress={navigate(`reorder_layers/${controlPath.join(':')}`)}
            icon={<LucideIcon icon="ArrowUpDown" />}
          >
            Sort Layers
          </Button>
        </XStack>
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

function NewLayerButton({
  controlPath,
  onScene,
}: {
  controlPath: string[];
  onScene: (update: (m: Scene) => Scene) => void;
}) {
  return (
    <BottomSheet
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="PlusCircle" />}>
          New Layer
        </BottomSheetTriggerButton>
      }
    >
      {ref('add_scene/' + controlPath.join(':'))}
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
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton chromeless icon={<LucideIcon icon="PlusCircle" />}>
          New Sequence Scene
        </BottomSheetTriggerButton>
      }
    >
      {ref('add_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
}

function SceneEffectsButton({ controlPath }: { controlPath: string[] }) {
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
      frameProps={{ padding: 0 }}
      trigger={
        <BottomSheetTriggerButton icon={<LucideIcon icon="UndoDot" />} theme="red">
          Reset Scene
        </BottomSheetTriggerButton>
      }
    >
      {ref('reset_scene/' + controlPath.join(':'))}
    </BottomSheet>
  );
}

function NarrowScrollView({ children }: { children?: JSXElement }) {
  return (
    <ScrollView contentContainerStyle={{ justifyContent: 'center', flexDirection: 'row' }}>
      <YStack f={1} maxWidth={600}>
        {children}
      </YStack>
    </ScrollView>
  );
}

function VideoScreen({ scene, onScene, controlPath, onGetMediaIndex, extraControls }: SceneScreenProps<VideoScene>) {
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

function EditTransition({
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
