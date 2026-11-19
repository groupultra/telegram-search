import { createSharedComposable, useColorMode, useLocalStorage } from '@vueuse/core'
import { computed, watchEffect } from 'vue'

export const APPEARANCE_MODES = ['light', 'dark', 'auto'] as const
export type AppearanceMode = typeof APPEARANCE_MODES[number]

// `swatch` is only used to paint the picker; the real colors live in
// styles/main.css under `[data-accent="…"]`.
export const ACCENT_THEMES = [
  { key: 'mono', swatch: 'hsl(var(--fg))' },
  { key: 'blue', swatch: 'hsl(217 91% 53%)' },
  { key: 'violet', swatch: 'hsl(258 84% 60%)' },
  { key: 'green', swatch: 'hsl(152 69% 31%)' },
  { key: 'orange', swatch: 'hsl(21 90% 48%)' },
  { key: 'rose', swatch: 'hsl(343 80% 50%)' },
] as const
export type AccentTheme = typeof ACCENT_THEMES[number]['key']

const ACCENT_STORAGE_KEY = 'tg-search/accent'

function isAccentTheme(value: string): value is AccentTheme {
  return ACCENT_THEMES.some(theme => theme.key === value)
}

/**
 * App-wide appearance state: light/dark/system mode plus the accent theme.
 * Shared so every switcher (rail, mobile menu, settings) drives one state.
 *
 * The mode uses VueUse's default storage key, the same one `useDark()` reads,
 * so components that only need `isDark` keep working unchanged.
 */
export const useAppearance = createSharedComposable(() => {
  const { store: mode, state } = useColorMode({ emitAuto: false })
  const storedAccent = useLocalStorage<string>(ACCENT_STORAGE_KEY, 'mono')

  const accent = computed<AccentTheme>({
    get: () => isAccentTheme(storedAccent.value) ? storedAccent.value : 'mono',
    set: (value) => { storedAccent.value = value },
  })
  const isDark = computed(() => state.value === 'dark')

  watchEffect(() => {
    document.documentElement.dataset.accent = accent.value
  })

  return { mode, accent, isDark }
})
