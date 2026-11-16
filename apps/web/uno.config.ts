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
  theme: {
    colors: {
      // Design tokens (styles/main.css). Prefer these in new markup.
      layout: 'hsl(var(--bg-layout))',
      container: 'hsl(var(--bg-container))',
      elevated: 'hsl(var(--bg-elevated))',
      fill: {
        DEFAULT: 'var(--fill)',
        2: 'var(--fill-secondary)',
        3: 'var(--fill-tertiary)',
        4: 'var(--fill-quaternary)',
      },
      line: {
        DEFAULT: 'hsl(var(--line))',
        2: 'hsl(var(--line-secondary))',
      },
      fg: {
        DEFAULT: 'hsl(var(--fg))',
        2: 'hsl(var(--fg-2))',
        3: 'hsl(var(--fg-3))',
        4: 'hsl(var(--fg-4))',
      },
      info: 'hsl(var(--info))',
      success: 'hsl(var(--success))',
      warning: 'hsl(var(--warning))',
      mask: 'var(--mask)',

      // shadcn-style aliases kept for existing markup.
      sidebar: 'hsl(var(--sidebar))',
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        hover: 'hsl(var(--primary-hover))',
        active: 'hsl(var(--primary-active))',
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
    boxShadow: {
      sm: 'var(--shadow-sm)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      // Popup surfaces: soft shadow plus a hairline instead of a border.
      popup: 'var(--shadow-md), var(--ring-line)',
      modal: 'var(--shadow-lg), var(--ring-line)',
    },
    // 4 / 6 / 8 / 12: checkbox and tags, buttons and menu items, inputs and
    // popups, modals and grouped containers.
    borderRadius: {
      xs: '4px',
      sm: '6px',
      md: '8px',
      lg: '12px',
    },
  },
  shortcuts: {
    // Small uppercase caption for group labels.
    eyebrow: 'text-[11px] text-fg-3 font-semibold tracking-[0.6px] uppercase leading-none',
  },
})
