<script setup lang="ts">
import { useDark, useToggle } from '@vueuse/core';
import { useI18n } from 'vue-i18n';

const emit = defineEmits<{
  (e: 'toggleSettingsDialog'): void
}>()

const isDark = useDark()
const toggleDark = useToggle(isDark)



const toggleSettingsDialog = () => {
  emit('toggleSettingsDialog')
}

</script>

<template>
   <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2">
            <div class="i-lucide-settings h-5 w-5" />
            <span class="text-lg font-medium">设置</span>
          </div>
          <button class="hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md p-1 transition-colors" @click="toggleSettingsDialog">
            <div class="i-lucide-x h-5 w-5" />
          </button>
        </div>
        <div class="space-y-4">
          <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
            <div class="flex items-center gap-2">
              <div class="i-lucide-moon h-5 w-5" />
              <span>深色模式</span>
            </div>
            <Switch :model-value="isDark" @update:model-value="toggleDark" />
          </div>
          <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
            <div class="flex items-center gap-2">
              <div class="i-lucide-globe h-5 w-5" />
              <span>语言</span>
            </div>
            <button class=" transition-colors">
              None
            </button>
          </div>
          <div class="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
            <div class="flex items-center gap-2">
              <div class="i-lucide-log-out h-5 w-5" />
              <span>退出登录</span>
            </div>
            <button class="text-red-500 hover:text-red-600 transition-colors">
              退出
        </button>
      </div>
    </div>
  </div>
</template>

