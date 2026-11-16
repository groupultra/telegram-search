<script setup lang="ts">
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { useI18n } from 'vue-i18n'

import AppearancePicker from '../appearance/AppearancePicker.vue'
import LanguagePicker from './LanguagePicker.vue'

import { Button } from '../ui/Button'

const { t } = useI18n()
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger as-child>
      <slot>
        <Button variant="ghost" size="icon" class="h-9 w-9" :aria-label="t('appearance.title')">
          <span class="i-lucide-palette h-4.5 w-4.5" />
        </Button>
      </slot>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        align="end"
        :side-offset="8"
        class="z-50 w-72 flex flex-col gap-4 border rounded-xl bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
      >
        <!-- Theme Switcher -->
        <AppearancePicker />
        <div class="h-px bg-border" />
        <!-- Language Switcher -->
        <LanguagePicker />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
