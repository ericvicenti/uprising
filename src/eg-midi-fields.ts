import { bounceField } from './state';
import { Dashboard, MainState, Scene } from './state-schema';

export type MidiField = {
  key: string;
  behavior: 'bounceButton' | 'goNextButton' | 'slider';
  field: string;
  min?: number;
  max?: number;
};

export function getDashboardMidiControls(
  dash: Dashboard | undefined,
  scene: Scene | undefined,
  dashboardId: 'live' | 'ready'
) {
  const sliders: { onValue: (value: number) => void }[] = [];
  const buttons: { onPress: () => void }[] = [];
  if (!dash || !scene) return { buttons, sliders };
  dash.forEach((item) => {
    if (item.behavior === 'slider') {
      // apply midiConfig.min and .max to value. value goes from 0-1
      // sliders.push({ behavior: 'slider', field: `${keyPrefix}.${item.field}`, key: item.key });
    }
    if (item.behavior === 'bounce') {
      buttons.push({
        onPress: () => {
          bounceField(dashboardId, item.field);
        },
      });
    }
    if (item.behavior === 'goNext') {
      buttons.push({
        onPress: () => {},
      });
    }
  });
  return { buttons, sliders };
}

export type DashMidi = ReturnType<typeof getDashboardMidiControls>;

export function getMidiControls(state: MainState | null) {
  return {
    live: getDashboardMidiControls(state?.liveDashboard, state?.liveScene, 'live'),
    ready: getDashboardMidiControls(state?.readyDashboard, state?.readyScene, 'ready'),
  };
}
