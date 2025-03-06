<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  isConnected?: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="!isConnected" class="mb-4 rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/30">
    <div class="flex">
      <div class="flex-shrink-0">
        <div class="i-lucide-warning h-5 w-5 text-yellow-400" aria-hidden="true" />
      </div>
      <div class="ml-3">
        <h3 class="text-sm text-yellow-800 font-medium dark:text-yellow-200">
          {{ t("component.export_command.no_connect") }}
        </h3>
        <div class="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
          <p>{{ t("component.export_command.must_connect") }}</p>
        </div>
        <div class="mt-3">
          <router-link
            to="/login"
            class="rounded-md bg-yellow-50 px-2 py-1.5 text-sm text-yellow-800 font-medium dark:bg-yellow-900/50 hover:bg-yellow-100 dark:text-yellow-200 dark:hover:bg-yellow-800/50"
          >
            {{ t("component.export_command.to_connect") }}
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
