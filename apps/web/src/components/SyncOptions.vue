<script setup lang="ts">
import type { SyncOptions } from '@tg-search/core'

import { format, parse } from 'date-fns'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const syncOptions = defineModel<SyncOptions>({ default: () => ({ syncMedia: true, maxMediaSize: 0 }) })

const { t } = useI18n()

// Local state
const syncMedia = ref(syncOptions.value.syncMedia ?? true)
const maxMediaSize = ref(syncOptions.value.maxMediaSize ?? 0)
const startTime = ref(syncOptions.value.startTime ? formatDateTime(syncOptions.value.startTime) : '')
const endTime = ref(syncOptions.value.endTime ? formatDateTime(syncOptions.value.endTime) : '')
const minMessageId = ref(syncOptions.value.minMessageId ?? undefined)
const maxMessageId = ref(syncOptions.value.maxMessageId ?? undefined)

function formatDateTime(date: Date): string {
  // Format as YYYY-MM-DDTHH:mm for datetime-local input
  return format(date, 'yyyy-MM-dd\'T\'HH:mm')
}

function parseDateTime(str: string): Date | undefined {
  if (!str)
    return undefined
  try {
    return parse(str, 'yyyy-MM-dd\'T\'HH:mm', new Date())
  }
  catch {
    return undefined
  }
}

// Update model when local state changes
watch([syncMedia, maxMediaSize, startTime, endTime, minMessageId, maxMessageId], () => {
  syncOptions.value = {
    syncMedia: syncMedia.value,
    maxMediaSize: maxMediaSize.value,
    startTime: parseDateTime(startTime.value),
    endTime: parseDateTime(endTime.value),
    minMessageId: minMessageId.value,
    maxMessageId: maxMessageId.value,
  }
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base text-foreground font-semibold">
        {{ t('sync.syncOptions') }}
      </h3>
    </div>

    <!-- Media Options -->
    <div class="space-y-3">
      <div class="flex items-start gap-3">
        <input
          id="sync-media"
          v-model="syncMedia"
          type="checkbox"
          class="mt-1 h-4 w-4 cursor-pointer border-gray-300 rounded text-primary focus:ring-2 focus:ring-primary"
        >
        <label for="sync-media" class="flex-1 cursor-pointer">
          <div class="text-sm text-foreground font-medium">
            {{ t('sync.syncMedia') }}
          </div>
          <div class="text-xs text-muted-foreground">
            {{ t('sync.syncMediaDescription') }}
          </div>
        </label>
      </div>

      <div v-if="syncMedia" class="ml-7 space-y-2">
        <label class="block text-sm text-foreground font-medium">
          {{ t('sync.maxMediaSize') }}
        </label>
        <div class="flex items-center gap-2">
          <input
            v-model.number="maxMediaSize"
            type="number"
            min="0"
            step="1"
            class="block w-32 border border-input rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
            placeholder="0"
          >
          <span class="text-sm text-muted-foreground">MB ({{ t('sync.noLimit') }})</span>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ t('sync.maxMediaSizeDescription') }}
        </p>
      </div>
    </div>

    <!-- Advanced Options -->
    <div class="border-t pt-4 space-y-4">
      <div>
        <h4 class="mb-3 text-sm text-foreground font-medium">
          {{ t('sync.syncRange') }}
        </h4>
        <p class="mb-3 text-xs text-muted-foreground">
          {{ t('sync.syncRangeDescription') }}
        </p>

        <!-- Time Range -->
        <div class="mb-4 space-y-2">
          <label class="block text-sm text-foreground font-medium">
            {{ t('sync.timeRange') }}
          </label>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label for="start-time" class="mb-1 block text-xs text-muted-foreground">
                {{ t('sync.startTime') }}
              </label>
              <input
                id="start-time"
                v-model="startTime"
                type="datetime-local"
                class="block w-full border border-input rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
            </div>
            <div>
              <label for="end-time" class="mb-1 block text-xs text-muted-foreground">
                {{ t('sync.endTime') }}
              </label>
              <input
                id="end-time"
                v-model="endTime"
                type="datetime-local"
                class="block w-full border border-input rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
            </div>
          </div>
        </div>

        <!-- Message ID Range -->
        <div class="space-y-2">
          <label class="block text-sm text-foreground font-medium">
            {{ t('sync.messageIdRange') }}
          </label>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label for="min-msg-id" class="mb-1 block text-xs text-muted-foreground">
                {{ t('sync.minMessageId') }}
              </label>
              <input
                id="min-msg-id"
                v-model.number="minMessageId"
                type="number"
                min="0"
                class="block w-full border border-input rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                placeholder="0"
              >
            </div>
            <div>
              <label for="max-msg-id" class="mb-1 block text-xs text-muted-foreground">
                {{ t('sync.maxMessageId') }}
              </label>
              <input
                id="max-msg-id"
                v-model.number="maxMessageId"
                type="number"
                min="0"
                class="block w-full border border-input rounded-md bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
                placeholder="0"
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
