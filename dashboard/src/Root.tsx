import '@tamagui/core/reset.css';

import { TamaguiProvider } from 'tamagui';

import { AutoSizeEGPreview } from './EGPreview';
import { FullscreenablePage } from './FullscreenablePage';
import config from './tamagui.config';
import { LiveURL, ReadyURL } from './urls';

export const Root = () => {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <FullscreenablePage>
        <AutoSizeEGPreview
          //label="Live"
          url={LiveURL}
        />
        {/* <AutoSizeEGPreview label="Ready" url={ReadyURL} /> */}
      </FullscreenablePage>
    </TamaguiProvider>
  );
};
