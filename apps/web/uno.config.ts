import lucide from '@iconify-json/lucide/icons.json'
import presetAnimations from 'unocss-preset-animations'
import presetShadcn from 'unocss-preset-shadcn'

import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWebFonts,
  presetWind3,
} from 'unocss'
import { presetScrollbar } from 'unocss-preset-scrollbar'

export default defineConfig({
  presets: [
    presetWind3(),
    presetAttributify(),
    presetIcons({
      collections: {
        lucide: () => lucide,
      },
      scale: 1.2,
      warn: true,
    }),
    presetWebFonts({
      provider: 'none',
      fonts: {
        sans: 'Inter:400,500,600,700',
        mono: 'Fira Code',
      },
    }),
    presetAnimations(),
    presetScrollbar({
      scrollbarWidth: '6px',
      scrollbarHeight: '6px',
      scrollbarTrackRadius: '4px',
      scrollbarThumbRadius: '4px',
    }),
    presetShadcn({
      color: 'zinc',
    }),
  ],
  shortcuts: {
    // Shared look for native form controls that cannot use the Input component
    // (selects, `v-model.number` inputs).
    'form-field': 'h-9 w-full flex border border-input rounded-md bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/30 focus-visible:border-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    // Small uppercase caption used for section labels and metadata.
    'eyebrow': 'text-[11px] text-muted-foreground font-medium tracking-wider uppercase',
  },
  theme: {
    colors: {
      sidebar: 'hsl(var(--sidebar))',
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
      },
      secondary: {
        DEFAULT: 'hsl(var(--secondary))',
        foreground: 'hsl(var(--secondary-foreground))',
      },
      destructive: {
        DEFAULT: 'hsl(var(--destructive))',
        foreground: 'hsl(var(--destructive-foreground))',
      },
      muted: {
        DEFAULT: 'hsl(var(--muted))',
        foreground: 'hsl(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'hsl(var(--accent))',
        foreground: 'hsl(var(--accent-foreground))',
      },
      popover: {
        DEFAULT: 'hsl(var(--popover))',
        foreground: 'hsl(var(--popover-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },
  },
})
