import { Button, InputField, LucideIcon, RiseForm, ScrollView, YStack } from '@rise-tools/kitchen-sink/server';
import { deleteLibraryItem, getLibraryItem, renameLibraryItem } from '../library';
import { goBack, navigate, StackScreen } from '@rise-tools/kit-react-navigation/server';
import { response } from '@rise-tools/react';
import { NarrowScrollView, Section } from './common';
import { mainStateUpdate } from '../state';
import { SubmitButton } from '@rise-tools/kitchen-sink/server';
import { ButtonGroup } from './button-group';

export function LibraryItemScreen({ item }: { item: string }) {
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
          theme="red"
          icon={<LucideIcon icon="Trash" />}
        >
          Delete from Library
        </Button>
      </YStack>
    </NarrowScrollView>
  );
}

export function LibraryIndex({ library }: { library?: string[] }) {
  return (
    <ScrollView>
      <StackScreen title="Scene Library" />
      <YStack padding="$4">
        <ButtonGroup
          items={
            library?.map((file) => ({
              key: file,
              label: file,
              onPress: navigate(`browse_library/${file}`),
            })) || []
          }
        />
      </YStack>
    </ScrollView>
  );
}
