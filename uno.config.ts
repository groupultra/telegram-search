import { presetChromatic } from '@proj-airi/unocss-preset-chromatic'
import {
  defineConfig,
  mergeConfigs,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind3,
} from 'unocss'
import presetAnimations from 'unocss-preset-animations'
import { presetScrollbar } from 'unocss-preset-scrollbar'
import { presetShadcn } from 'unocss-preset-shadcn'

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
      presetShadcn({
        color: 'blue',
      }),
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
    ],
    // Content extraction configuration for shadcn-vue
    content: {
      pipeline: {
        include: [
          // The default patterns
          /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
          // Include js/ts files for shadcn components
          '(components|src|packages)/**/*.{js,ts}',
        ],
      },
    },
  })
}

export default mergeConfigs([
  sharedUnoConfig(),
])
