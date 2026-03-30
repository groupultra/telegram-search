<script setup lang="ts">
import type { ChatSyncStats } from '@tg-search/core'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<Props>()

const { t } = useI18n()

interface Props {
  stats?: ChatSyncStats
  loading?: boolean
  chatLabel?: string
}

const isOpen = ref(true)

const syncedCount = computed(() => props.stats?.syncedMessages ?? 0)
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
  return Math.round((props.stats.syncedMessages / props.stats.totalMessages) * 100)
})

const syncedWidth = computed(() => `${syncPercentage.value}%`)
const unsyncedWidth = computed(() => `${Math.max(0, 100 - syncPercentage.value)}%`)
</script>

<template>
  <div class="space-y-3">
    <div class="w-full flex items-center justify-between gap-4">
      <button
        type="button"
        class="min-w-0 flex-1 text-left"
        @click="isOpen = !isOpen"
      >
        <h3 class="text-sm text-foreground font-semibold">
          {{ t('sync.syncVisualization') }}
        </h3>
        <p v-if="props.chatLabel" class="truncate pt-1 text-xs text-muted-foreground">
          {{ props.chatLabel }}
        </p>
      </button>

      <div class="flex items-center gap-3">
        <div
          v-if="stats"
          class="border border-border/60 rounded-full bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
        >
          {{ t('sync.syncProgress') }}:
          <span class="ml-1 text-foreground font-medium">{{ syncPercentage }}%</span>
        </div>
      </div>
    </div>

    <Transition name="collapse-vertical">
      <div v-show="isOpen" class="space-y-3">
        <div v-if="loading && !stats" class="space-y-3">
          <div class="grid gap-2 md:grid-cols-3">
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
            <div class="h-14 animate-pulse rounded-xl bg-muted" />
          </div>
          <div class="h-2.5 animate-pulse rounded-full bg-muted" />
        </div>

        <div v-else-if="stats" class="space-y-3">
          <div class="grid gap-2 md:grid-cols-[repeat(3,minmax(0,1fr))]">
            <div class="border border-border/60 rounded-xl bg-muted/35 px-3 py-2.5">
              <div class="text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
                {{ t('sync.totalMessages') }}
              </div>
              <div class="pt-1 text-xl text-foreground font-semibold tabular-nums">
                {{ totalCount }}
              </div>
            </div>
            <div class="border border-emerald-500/20 rounded-xl bg-emerald-500/8 px-3 py-2.5">
              <div class="text-[11px] text-emerald-600 tracking-[0.16em] uppercase dark:text-emerald-400">
                {{ t('sync.syncedMessages') }}
              </div>
              <div class="pt-1 text-xl text-emerald-600 font-semibold tabular-nums dark:text-emerald-400">
                {{ syncedCount }}
              </div>
            </div>
            <div class="border border-slate-400/20 rounded-xl bg-slate-500/8 px-3 py-2.5">
              <div class="text-[11px] text-slate-500 tracking-[0.16em] uppercase dark:text-slate-400">
                {{ t('sync.unsyncedMessages') }}
              </div>
              <div class="pt-1 text-xl text-slate-600 font-semibold tabular-nums dark:text-slate-300">
                {{ unsyncedCount }}
              </div>
            </div>
          </div>

          <div class="border border-border/60 rounded-xl bg-background/70 p-3">
            <div class="mb-2 flex items-center justify-between gap-3 text-xs">
              <span class="text-muted-foreground">{{ t('sync.syncProgress') }}</span>
              <span class="text-foreground font-medium tabular-nums">{{ syncPercentage }}%</span>
            </div>

            <div class="relative overflow-hidden border border-border/50 rounded-xl bg-muted/40 px-2 py-2.5">
              <div
                class="relative h-11 w-full flex overflow-hidden rounded-lg"
              >
                <div
                  class="min-w-0 flex items-center justify-center bg-emerald-500/75 px-3 text-xs text-emerald-950 font-semibold transition-all duration-500 ease-out dark:text-emerald-50"
                  :style="{ width: syncedWidth }"
                >
                  <span v-if="syncedCount > 0" class="truncate tabular-nums">
                    {{ syncedCount }}
                  </span>
                </div>
                <div
                  class="min-w-0 flex items-center justify-center bg-slate-300/80 px-3 text-xs text-slate-700 font-semibold transition-all duration-500 ease-out dark:bg-slate-200/70 dark:text-slate-900"
                  :style="{ width: unsyncedWidth }"
                >
                  <span v-if="unsyncedCount > 0" class="truncate tabular-nums">
                    {{ unsyncedCount }}
                  </span>
                </div>
              </div>
            </div>

            <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-emerald-500" />
                {{ t('sync.syncedMessages') }}
              </span>
              <span class="inline-flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-500" />
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
