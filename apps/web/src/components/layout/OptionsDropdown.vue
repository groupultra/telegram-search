<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import AppearancePicker from '../appearance/AppearancePicker.vue'
import LanguagePicker from './LanguagePicker.vue'

import { ActionIcon } from '../ui/ActionIcon'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/Popover'

withDefaults(defineProps<{
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  size?: 'sm' | 'md' | 'lg'
}>(), {
  side: 'bottom',
  align: 'end',
  size: 'md',
})

const { t } = useI18n()
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <ActionIcon icon="i-lucide-palette" :size="size" :title="t('appearance.title')" :tooltip-side="side === 'right' ? 'right' : undefined" />
    </PopoverTrigger>
    <PopoverContent :side="side" :align="align" class="w-68 flex flex-col gap-4 p-4">
      <!-- Theme Switcher -->
      <AppearancePicker />
      <div class="h-px bg-line-2" />
      <!-- Language Switcher -->
      <LanguagePicker />
    </PopoverContent>
  </Popover>
</template>
