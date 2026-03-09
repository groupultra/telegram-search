<script setup lang="ts">
import { useSettingsStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { runThemeAppearanceTransition } from '../../lib/utils'
import { Button } from '../ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'

const { t, locale } = useI18n()
const isDark = useDark()

const settingsStore = useSettingsStore()
const { language } = storeToRefs(settingsStore)

const languageOptions = computed(() => [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
])

watch(language, (newValue) => {
  locale.value = newValue
}, { immediate: true })

function selectLanguage(value: string) {
  language.value = value
}

function toggleTheme(event: Event) {
  void runThemeAppearanceTransition(event, async () => {
    isDark.value = !isDark.value
    await nextTick()
  })
}
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full">
          <span class="i-lucide-more-vertical h-4 w-4" />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-[180px]">
      <!-- Theme Switcher -->
      <DropdownMenuItem class="cursor-pointer gap-2" @select="toggleTheme">
        <span :class="isDark ? 'i-lucide-moon' : 'i-lucide-sun'" class="h-4 w-4" />
        <span>{{ isDark ? t('settings.switchToLightMode') : t('settings.switchToDarkMode') }}</span>
      </DropdownMenuItem>

      <DropdownMenuSeparator />

      <!-- Language Switcher -->
      <DropdownMenuLabel>{{ t('settings.language') }}</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="option in languageOptions"
        :key="option.value"
        class="cursor-pointer justify-between"
        @select="selectLanguage(option.value)"
      >
        <span>{{ option.label }}</span>
        <span v-if="language === option.value" class="i-lucide-check h-4 w-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
