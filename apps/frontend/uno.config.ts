import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetUno,
  presetWebFonts,
} from 'unocss'

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
      'background': 'var(--c-background)',
      'foreground': 'var(--c-foreground)',
      'card': 'var(--c-card)',
      'card-foreground': 'var(--c-card-foreground)',
      'popover': 'var(--c-popover)',
      'popover-foreground': 'var(--c-popover-foreground)',
      'primary': 'var(--c-primary)',
      'primary-foreground': 'var(--c-primary-foreground)',
      'secondary': 'var(--c-secondary)',
      'secondary-foreground': 'var(--c-secondary-foreground)',
      'muted': 'var(--c-muted)',
      'muted-foreground': 'var(--c-muted-foreground)',
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
