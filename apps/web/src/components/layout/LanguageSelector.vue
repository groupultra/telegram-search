<script setup lang="ts">
import { useSettingsStore } from '@tg-search/client'
import { onClickOutside } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '../ui/Button'

const { t, locale } = useI18n()

const settingsStore = useSettingsStore()
const { language } = storeToRefs(settingsStore)

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

const languageOptions = computed(() => [
  { label: t('settings.chinese'), value: 'zhCN' },
  { label: t('settings.english'), value: 'en' },
])

watch(language, (newValue: string) => {
  locale.value = newValue
}, { immediate: true })

function selectLanguage(value: string) {
  language.value = value
  isOpen.value = false
}

onClickOutside(dropdownRef, () => {
  isOpen.value = false
})
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <Button
      icon="i-lucide-globe"
      class="h-8 w-8 rounded-md p-0"
      variant="ghost"
      size="sm"
      :title="t('settings.language')"
      @click="isOpen = !isOpen"
    />

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="bg-popover absolute bottom-full right-0 z-50 mb-2 min-w-[120px] overflow-hidden border rounded-md shadow-md"
      >
        <button
          v-for="option in languageOptions"
          :key="option.value"
          class="hover:bg-accent hover:text-accent-foreground w-full px-3 py-2 text-left text-sm transition-colors"
          :class="{ 'bg-accent text-accent-foreground': language === option.value }"
          @click="selectLanguage(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </Transition>
  </div>
</template>
