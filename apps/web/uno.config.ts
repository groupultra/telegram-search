import presetAnimations from 'unocss-preset-animations'
import presetShadcn from 'unocss-preset-shadcn'

import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import {
  defineConfig,
  mergeConfigs,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind3,
} from 'unocss'
import { presetScrollbar } from 'unocss-preset-scrollbar'

export function sharedUnoConfig() {
  return defineConfig({
    presets: [
      presetWind3(),
      presetAttributify(),
      presetIcons(),
      presetWebFonts({
        provider: 'google',
        fonts: {
          sans: 'Roboto',
        },
      }),
      presetAnimations(),
      presetChromatic({
        baseHue: 220.44,
        colors: {
          primary: 0,
          complementary: 180,
        },
      }),
      presetScrollbar({
        scrollbarWidth: '6px',
        scrollbarHeight: '6px',
        scrollbarTrackRadius: '4px',
        scrollbarThumbRadius: '4px',
      }),
      presetShadcn({
        color: 'blue',
      }),
    ],
  })
}

export default mergeConfigs([
  sharedUnoConfig(),
])
