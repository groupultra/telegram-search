<script setup lang="ts">
import type { AppearanceMode } from '../../composables/use-appearance'

import { nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

import { ACCENT_THEMES, APPEARANCE_MODES, useAppearance } from '../../composables/use-appearance'
import { runThemeAppearanceTransition } from '../../lib/utils'

const { t } = useI18n()
const { mode, accent } = useAppearance()

const MODE_ICON_CLASS = {
  light: 'i-lucide-sun',
  dark: 'i-lucide-moon',
  auto: 'i-lucide-monitor',
} as const satisfies Record<AppearanceMode, string>

function selectMode(event: Event, value: AppearanceMode) {
  if (mode.value === value) {
    return
  }

  void runThemeAppearanceTransition(event, async () => {
    mode.value = value
    await nextTick()
  })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <span class="eyebrow">{{ t('appearance.mode') }}</span>
      <div class="grid grid-cols-3 gap-1 border rounded-lg bg-muted/60 p-1" role="radiogroup" :aria-label="t('appearance.mode')">
        <button
          v-for="item in APPEARANCE_MODES"
          :key="item"
          type="button"
          role="radio"
          :aria-checked="mode === item"
          class="h-8 flex items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-colors"
          :class="mode === item
            ? 'bg-background text-foreground font-medium shadow-sm'
            : 'text-muted-foreground hover:text-foreground'"
          @click="selectMode($event, item)"
        >
          <span :class="MODE_ICON_CLASS[item]" class="h-3.5 w-3.5 shrink-0" />
          <span class="truncate">{{ t(`appearance.modes.${item}`) }}</span>
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="eyebrow">{{ t('appearance.accent') }}</span>
      <div class="flex items-center gap-2" role="radiogroup" :aria-label="t('appearance.accent')">
        <button
          v-for="theme in ACCENT_THEMES"
          :key="theme.key"
          type="button"
          role="radio"
          :aria-checked="accent === theme.key"
          :aria-label="t(`appearance.accents.${theme.key}`)"
          :title="t(`appearance.accents.${theme.key}`)"
          class="h-7 w-7 flex items-center justify-center rounded-full transition-transform active:scale-95 hover:scale-110"
          :class="accent === theme.key ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover' : ''"
          :style="{ backgroundColor: theme.swatch }"
          @click="accent = theme.key"
        >
          <span
            v-if="accent === theme.key"
            class="i-lucide-check h-3.5 w-3.5"
            :class="theme.key === 'mono' ? 'text-background' : 'text-white'"
          />
        </button>
      </div>
    </div>
  </div>
</template>
