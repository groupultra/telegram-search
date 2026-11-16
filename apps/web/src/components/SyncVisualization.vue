<script setup lang="ts">
import type { ChatSyncStats } from '@tg-search/core'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<Props>()

const emit = defineEmits<{
  abort: []
  close: []
}>()

const { t } = useI18n()

interface Props {
  stats?: ChatSyncStats
  loading?: boolean
  chatLabel?: string
  showAbort?: boolean
  showClose?: boolean
}

const isOpen = ref(true)

const syncedCount = computed(() => {
  if (!props.stats) {
    return 0
  }
  return Math.max(0, Math.min(props.stats.syncedMessages, props.stats.totalMessages))
})
const totalCount = computed(() => props.stats?.totalMessages ?? 0)
const unsyncedCount = computed(() => {
  if (!props.stats) {
    return 0
  }
  return Math.max(0, props.stats.totalMessages - props.stats.syncedMessages)
})

const syncPercentage = computed(() => {
  if (!props.stats || props.stats.totalMessages === 0) {
    return 0
  }
  return Math.max(0, Math.min(100, Math.round((syncedCount.value / props.stats.totalMessages) * 100)))
})

const syncedWidth = computed(() => `${syncPercentage.value}%`)
const unsyncedWidth = computed(() => `${Math.max(0, 100 - syncPercentage.value)}%`)
</script>

<template>
  <div class="space-y-4">
    <div class="w-full flex items-center justify-between gap-4">
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="isOpen = !isOpen"
      >
        <p class="text-[11px] text-muted-foreground tracking-wider uppercase">
          {{ t('sync.currentChatLabel') }}
        </p>
        <h3 class="pt-1 text-lg text-foreground font-semibold">
          {{ t('sync.syncVisualization') }}
        </h3>
        <p v-if="props.chatLabel" class="truncate pt-1 text-sm text-muted-foreground">
          {{ props.chatLabel }}
        </p>
      </button>
      <div class="flex shrink-0 flex-col items-end gap-2">
        <button
          v-if="props.showClose"
          type="button"
          class="h-9 w-9 flex items-center justify-center border border-border/50 rounded-full bg-transparent text-muted-foreground transition-colors md:h-10 md:w-10 hover:text-foreground"
          @click="emit('close')"
        >
          <span class="i-lucide-x h-4 w-4" />
        </button>
        <button
          v-if="props.showAbort"
          type="button"
          class="h-8 min-w-[3.5rem] flex items-center justify-center border border-border/50 rounded-full bg-transparent px-3 text-xs text-muted-foreground font-medium transition-colors hover:text-foreground"
          @click="emit('abort')"
        >
          {{ t('common.cancel') }}
        </button>
      </div>
    </div>

    <Transition name="collapse-vertical">
      <div v-show="isOpen" class="space-y-4">
        <div v-if="loading && !stats" class="space-y-3">
          <div class="grid gap-2 md:grid-cols-3">
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
          </div>
          <div class="h-2.5 animate-pulse rounded-full bg-muted" />
        </div>

        <div v-else-if="stats" class="space-y-3">
          <div class="grid gap-2.5 md:grid-cols-[repeat(3,minmax(0,1fr))] md:gap-3">
            <div class="rounded-lg bg-transparent px-4 py-3 ring-1 ring-border">
              <div class="text-[11px] text-muted-foreground tracking-wider uppercase">
                {{ t('sync.totalMessages') }}
              </div>
              <div class="pt-2 text-[2rem] text-foreground font-semibold tabular-nums md:text-3xl">
                {{ totalCount }}
              </div>
            </div>
            <div class="rounded-lg bg-transparent px-4 py-3 ring-1 ring-border">
              <div class="text-[11px] text-foreground tracking-wider uppercase">
                {{ t('sync.syncedMessages') }}
              </div>
              <div class="pt-2 text-[2rem] text-foreground font-semibold tabular-nums md:text-3xl">
                {{ syncedCount }}
              </div>
            </div>
            <div class="rounded-lg bg-transparent px-4 py-3 ring-1 ring-border">
              <div class="text-[11px] text-muted-foreground tracking-wider uppercase">
                {{ t('sync.unsyncedMessages') }}
              </div>
              <div class="pt-2 text-[2rem] text-muted-foreground font-semibold tabular-nums md:text-3xl">
                {{ unsyncedCount }}
              </div>
            </div>
          </div>

          <div class="relative overflow-hidden rounded-lg bg-foreground/8 p-3 ring-1 ring-border md:p-4">
            <div
              class="relative h-12 w-full flex overflow-hidden rounded-lg md:h-14"
            >
              <div
                class="min-w-0 flex items-center justify-center bg-primary px-3 text-sm text-primary-foreground font-semibold transition-all duration-500 ease-out"
                :style="{ width: syncedWidth }"
              >
                <span v-if="syncedCount > 0" class="truncate tabular-nums">
                  {{ syncedCount }}
                </span>
              </div>
              <div
                class="min-w-0 flex items-center justify-center bg-muted px-3 text-sm text-muted-foreground font-semibold transition-all duration-500 ease-out"
                :style="{ width: unsyncedWidth }"
              >
                <span v-if="unsyncedCount > 0" class="truncate tabular-nums">
                  {{ unsyncedCount }}
                </span>
              </div>
            </div>

            <div class="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-primary" />
                {{ t('sync.syncedMessages') }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-muted" />
                {{ t('sync.unsyncedMessages') }}
              </span>
            </div>
          </div>
        </div>

        <div v-else class="py-3 text-sm text-muted-foreground">
          {{ t('sync.selectChats') }}
        </div>
      </div>
    </Transition>
  </div>
</template>
