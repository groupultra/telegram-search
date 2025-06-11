import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  presetWebFonts,
} from 'unocss'

const getShades = (hueBaseVariable: string, hueOffset: number) => ({
  0: "rgb(255 255 255 / %alpha)",
  50: `color-mix(in srgb, oklch(95% var(--theme-colors-chroma-50) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha) 30%, oklch(100% 0 360 / %alpha))`,
  100: `color-mix(in srgb, oklch(95% var(--theme-colors-chroma-100) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha) 80%, oklch(100% 0 360 / %alpha))`,
  200: `oklch(90% var(--theme-colors-chroma-200) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  300: `oklch(85% var(--theme-colors-chroma-300) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  400: `oklch(74% var(--theme-colors-chroma-400) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  450: `oklch(68% var(--theme-colors-chroma-450) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  500: `oklch(62% var(--theme-colors-chroma) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  600: `oklch(54% var(--theme-colors-chroma-600) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  700: `oklch(49% var(--theme-colors-chroma-700) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  800: `oklch(42% var(--theme-colors-chroma-800) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  900: `oklch(37% var(--theme-colors-chroma-900) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  950: `oklch(29% var(--theme-colors-chroma-950) calc(var(--theme-colors-${hueBaseVariable}) + ${hueOffset}) / %alpha)`,
  1000: "rgb(0 0 0 / %alpha)",
}) as const;

type ShadeKey = keyof ReturnType<typeof getShades>;
type ShadeDescriptor = ShadeKey | {
  key: ShadeKey;
  alpha?: number;
  mixBlack?: number;
  mixWhite?: number;
  mixPureBackground?: number;
  mixPureForeground?: number;
};
type ShadePair = { dark: ShadeDescriptor, light: ShadeDescriptor };

function createColorSchemeConfig(options: {
  hueBaseVariable?: string
  hueOffset?: number;
  defaultShade?: ShadePair;
  foregroundShade?: ShadePair;
} = {}) {
  const { hueBaseVariable = 'hue', hueOffset = 0, defaultShade = { dark: 500, light: 600 }, foregroundShade = { dark: 100, light: 200 } } = options;
  const shades = getShades(hueBaseVariable, hueOffset);
  const resolveShade = (descriptor: ShadeDescriptor) => {
    if (typeof descriptor !== 'object') {
      return shades[descriptor];
    }
    const { key, alpha, mixBlack, mixWhite, mixPureBackground, mixPureForeground } = descriptor;
    let percent: number;
    let mixTo: string;
    if (alpha != null) {
      percent = alpha;
      mixTo = `transparent`;
    } else if (mixBlack != null) {
      percent = mixBlack;
      mixTo = `black`;
    } else if (mixWhite != null) {
      percent = mixWhite;
      mixTo = `white`;
    } else if (mixPureBackground != null) {
      percent = mixPureBackground;
      mixTo = `color-mix(in srgb, white, black var(--is-dark))`;
    } else if (mixPureForeground != null) {
      percent = mixPureForeground;
      mixTo = `color-mix(in srgb, white, black var(--is-dark))`;
    } else {
      return shades[key];
    }
    return `color-mix(in srgb, ${shades[key]} ${percent}%, ${mixTo})`;
  };

  const { dark: defaultDark, light: defaultLight } = defaultShade;
  const { dark: foregroundDark, light: foregroundLight } = foregroundShade;

  return {
    ...shades,
    DEFAULT: `color-mix(in srgb, ${resolveShade(defaultLight)}, ${resolveShade(defaultDark)} var(--is-dark))`,
    foreground: `color-mix(in srgb, ${resolveShade(foregroundLight)}, ${resolveShade(foregroundDark)} var(--is-dark))`,
  };
}

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'text-[0.9em] inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600 !outline-none'],
    ['animate-fade-in', 'animate-fade-in'],
    ['animate-spin', 'animate-spin'],
    ['animate-pulse', 'animate-pulse'],
    ['scale-102', 'transform scale-102'],
    ['scale-98', 'transform scale-98'],
    // Grid list transitions
    ['grid-list-move', 'transition-all duration-300 ease-in-out'],
    ['grid-list-enter-active', 'transition-all duration-300 ease-in-out'],
    ['grid-list-leave-active', 'transition-all duration-300 ease-in-out absolute'],
    ['grid-list-enter-from', 'opacity-0 translate-y-8'],
    ['grid-list-leave-to', 'opacity-0 translate-y-8'],
    // Fade transitions
    ['fade-enter-active', 'transition-all duration-200 ease-in-out'],
    ['fade-leave-active', 'transition-all duration-200 ease-in-out'],
    ['fade-enter-from', 'opacity-0 scale-80'],
    ['fade-leave-to', 'opacity-0 scale-80'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons(),
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Roboto',
      },
    }),
  ],
  theme: {
    animation: {
      keyframes: {
        'fade-in': '{from{opacity:0}to{opacity:1}}',
        'spin': '{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
        'pulse': '{0%,100%{opacity:1}50%{opacity:0.7}}',
      },
      durations: {
        'fade-in': '0.5s',
        'spin': '1.5s',
        'pulse': '2s',
      },
      timingFns: {
        'fade-in': 'ease-in-out',
        'spin': 'linear',
        'pulse': 'cubic-bezier(0.4,0,0.6,1)',
      },
      counts: {
        spin: 'infinite',
        pulse: 'infinite',
      },
    },
    colors: {
      background: createColorSchemeConfig({
        defaultShade: {
          light: { key: 50, mixPureBackground: 15 },
          dark: { key: 950, mixPureBackground: 10 },
        }
      }).DEFAULT,
      foreground: createColorSchemeConfig({
        defaultShade: {
          light: 950,
          dark: 50
        }
      }).DEFAULT,
      card: createColorSchemeConfig({
        defaultShade: {
          light: { key: 100, mixWhite: 35 },
          dark: { key: 900, mixBlack: 20 }
        }
      }),
      popover: createColorSchemeConfig({
        defaultShade: {
          light: 100,
          dark: { key: 900, mixWhite: 50 }
        }
      }),
      primary: createColorSchemeConfig({
        defaultShade: {
          light: 200,
          dark: 800
        }
      }),
      secondary: createColorSchemeConfig({
        defaultShade: {
          light: { key: 800, mixWhite: 20 },
          dark: { key: 300, mixBlack: 20 }
        },
        foregroundShade: {
          light: { key: 800, mixWhite: 80 },
          dark: { key: 300, mixBlack: 80 }
        }
      }),
      muted: createColorSchemeConfig({
        defaultShade: {
          light: { key: 400, mixWhite: 15 },
          dark: { key: 800, mixBlack: 30 }
        },
        foregroundShade: {
          light: { key: 900, mixWhite: 30 },
          dark: { key: 200, mixBlack: 70 }
        }
      }),
    },
  },
  safelist: [
    'animate-fade-in',
    'animate-spin',
    'animate-pulse',
    'scale-102',
    'scale-98',
    'grid-list-move',
    'grid-list-enter-active',
    'grid-list-leave-active',
    'grid-list-enter-from',
    'grid-list-leave-to',
    'fade-enter-active',
    'fade-leave-active',
    'fade-enter-from',
    'fade-leave-to',
  ],
})
