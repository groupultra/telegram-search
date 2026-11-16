<script setup lang="ts">
import { useSettingsStore } from '@tg-search/client'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
    <div class="flex flex-col gap-0.5" role="radiogroup" :aria-label="t('settings.language')">
      <button
        v-for="option in LANGUAGE_OPTIONS"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="language === option.value"
        class="h-8 flex items-center justify-between rounded-md px-2 text-sm transition-colors hover:bg-accent"
        :class="language === option.value ? 'text-foreground font-medium' : 'text-muted-foreground'"
        @click="language = option.value"
      >
        <span>{{ option.label }}</span>
        <span v-if="language === option.value" class="i-lucide-check h-3.5 w-3.5" />
      </button>
    </div>
  </div>
</template>
