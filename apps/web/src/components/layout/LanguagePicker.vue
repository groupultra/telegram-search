<script setup lang="ts">
import { useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { ListItem } from '../ui/ListItem'

const { t, locale } = useI18n()

const settingsStore = useSettingsStore()
const { language } = storeToRefs(settingsStore)

const LANGUAGE_OPTIONS = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en' },
  { label: '한국어', value: 'ko' },
] as const

watch(language, (newValue) => {
  locale.value = newValue
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="eyebrow">{{ t('settings.language') }}</span>
    <div class="flex flex-col gap-0.5 -mx-1" role="radiogroup" :aria-label="t('settings.language')">
      <ListItem
        v-for="option in LANGUAGE_OPTIONS"
        :key="option.value"
        role="radio"
        :aria-checked="language === option.value"
        class="px-2"
        :class="language === option.value ? 'text-fg' : ''"
        @click="language = option.value"
      >
        {{ option.label }}
        <template v-if="language === option.value" #suffix>
          <span class="i-lucide-check h-4 w-4 shrink-0" />
        </template>
      </ListItem>
    </div>
  </div>
</template>
