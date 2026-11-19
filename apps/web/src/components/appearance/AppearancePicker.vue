<script setup lang="ts">
import type { AppearanceMode } from '../../composables/use-appearance'
import type { SegmentedOption } from '../ui/Segmented'

import { computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

import { ACCENT_THEMES, APPEARANCE_MODES, useAppearance } from '../../composables/use-appearance'
import { runThemeAppearanceTransition } from '../../lib/utils'
import { Segmented } from '../ui/Segmented'
import { Tooltip } from '../ui/Tooltip'

const { t } = useI18n()
const { mode, accent } = useAppearance()

const MODE_ICON_CLASS = {
  light: 'i-lucide-sun',
  dark: 'i-lucide-moon',
  auto: 'i-lucide-monitor',
} as const satisfies Record<AppearanceMode, string>

const modeOptions = computed<SegmentedOption<AppearanceMode>[]>(() => APPEARANCE_MODES.map(item => ({
  value: item,
  label: t(`appearance.modes.${item}`),
  icon: MODE_ICON_CLASS[item],
})))

// The Segmented model is one-way here: the change is applied inside a view
// transition so the new theme sweeps in from the click position.
function selectMode(value: AppearanceMode, event: MouseEvent) {
  if (mode.value === value)
    return

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
      <Segmented
        :model-value="mode"
        :options="modeOptions"
        :aria-label="t('appearance.mode')"
        size="sm"
        block
        @select="selectMode"
      />
    </div>

    <div class="flex flex-col gap-2">
      <span class="eyebrow">{{ t('appearance.accent') }}</span>
      <div class="flex items-center gap-2.5" role="radiogroup" :aria-label="t('appearance.accent')">
        <Tooltip v-for="theme in ACCENT_THEMES" :key="theme.key" :content="t(`appearance.accents.${theme.key}`)">
          <button
            type="button"
            role="radio"
            :aria-checked="accent === theme.key"
            :aria-label="t(`appearance.accents.${theme.key}`)"
            class="h-6 w-6 flex items-center justify-center rounded-full transition-shadow duration-150"
            :class="accent === theme.key ? 'shadow-[0_0_0_2px_hsl(var(--bg-elevated)),0_0_0_4px_var(--fill)]' : ''"
            :style="{ backgroundColor: theme.swatch }"
            @click="accent = theme.key"
          >
            <span
              v-if="accent === theme.key"
              class="i-lucide-check h-3.5 w-3.5"
              :class="theme.key === 'mono' ? 'text-container' : 'text-white'"
            />
          </button>
        </Tooltip>
      </div>
    </div>
  </div>
</template>
