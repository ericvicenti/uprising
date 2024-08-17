import { getMidiFields } from './eg-midi-fields';
import { mainState } from './state';
import { subscribeMidiEvents } from './eg-midi-server';

export function initMidiController() {
  let midiDashboard = getMidiFields(mainState.get());

  mainState.subscribe((state) => {
    if (!state) return;
    midiDashboard = getMidiFields(state);
  });

  const midiLiveButtons = [23, 24, 25, 26];
  const midiReadyButtons = [27, 28, 29, 30];
  const midiLiveSliders = [3, 4, 5, 6, 14, 15, 16, 17];
  const midiReadySliders = [7, 8, 9, 10, 18, 19, 20, 21];

  subscribeMidiEvents((event) => {
    // Chanel Number Map
    //                   1️⃣ 2️⃣  3️⃣ 4️⃣  5️⃣ 6️⃣  7️⃣ 8️⃣  🔽
    // 67   program  64  14  15  16  17  18  19  20  21  22 <- Knobs
    // 🅰️   change  🅱️    3   4   5   6   7   8   9  10  11 <- Sliders
    //      - 60 +       23  24  25  26  27  28  29  30  31 <- Buttons
    // Bank         1  2           49 47 48  46 45 44       <- Extra Buttons
    //                             🔁 ⏪ ⏩  ⏹️  ▶️  ⏺️
    const { key } = event;
    if (key === 'bank') return;
    if (key === 'program') return;
    const { channel, value } = event;
    if (channel === 67 && value == 1) {
      startAutoTransition();
    }
    // if (channel === 60) {
    //   if (isMidiTouchingManualTransition) {
    //     midiSetManualTransition(value);
    //     return;
    //   }
    //   const currentManualValue = mainState.transitionState?.manual ?? 0;
    //   const offsetFromCurrentState = Math.abs(value - currentManualValue);
    //   if (offsetFromCurrentState < SliderGrabDelta) {
    //     isMidiTouchingManualTransition = true;
    //     midiSetManualTransition(value);
    //   }
    // }
    const liveButton = midiLiveButtons.indexOf(channel);
    if (liveButton !== -1) {
      const midiConfig = midiDashboard.live.buttons[liveButton];
      if (!midiConfig) return;
      if (midiConfig.behavior === 'bounceButton') bounceField(midiConfig.field);
      if (midiConfig.behavior === 'goNextButton') goNext(midiConfig.field.split('.'));
      return;
    }

    const readyButton = midiReadyButtons.indexOf(channel);
    if (readyButton !== -1) {
      const midiConfig = midiDashboard.ready.buttons[readyButton];
      if (!midiConfig) return;
      if (midiConfig.behavior === 'bounceButton') bounceField(midiConfig.field);
      return;
    }
    const liveSlider = midiLiveSliders.indexOf(channel);
    if (liveSlider !== -1) {
      const midiConfig = midiDashboard.live.sliders[liveSlider];
      if (!midiConfig) return;
      // apply midiConfig.min and .max to value. value goes from 0-1
      const min = midiConfig.min || 0;
      const max = midiConfig.max || 1;
      const outputValue = (max - min) * value + min;
      slowUpdateSliderValue(midiConfig.field, outputValue);
      return;
    }
    const readySlider = midiReadySliders.indexOf(channel);
    if (readySlider !== -1) {
      const midiConfig = midiDashboard.ready.sliders[readySlider];
      if (!midiConfig) return;
      const min = midiConfig.min || 0;
      const max = midiConfig.max || 1;
      const outputValue = (max - min) * value + min;
      slowUpdateSliderValue(midiConfig.field, outputValue);
      return;
    }
    console.log('midi event', event);
  });
}
