<script setup lang="ts">
import { useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '../ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'

const { t, locale } = useI18n()

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
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        class="h-8 w-8 p-0"
        :title="t('settings.language')"
      >
        <span class="i-lucide-globe h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem
        v-for="option in languageOptions"
        :key="option.value"
        @select="selectLanguage(option.value)"
      >
        <span :class="language === option.value ? 'font-bold' : ''">
          {{ option.label }}
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
