<script setup lang="ts">
import SyncStatsSummaryPanel from './SyncStatsSummaryPanel.vue'

import { Button } from './ui/Button'

interface Props {
  open: boolean
  selectedTab: 'selected' | 'current'
  hasSelectedStatusPanel: boolean
  hasCurrentStatusPanel: boolean
  selectedLabel: string
  currentLabel: string
  selectedTitle: string
  selectedProgress: number
  selectedTotalCount: number
  selectedSyncedCount: number
  selectedUnsyncedCount: number
  selectedHasError?: boolean
  currentTitle: string
  currentSubtitle?: string
  currentProgress: number
  currentTotalCount: number
  currentSyncedCount: number
  currentUnsyncedCount: number
  currentLoading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:selectedTab': [value: 'selected' | 'current']
  'close': []
}>()

function closeDrawer() {
  emit('update:open', false)
  emit('close')
}
</script>

<template>
  <div v-if="props.open">
    <div
      class="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px]"
      @click="closeDrawer"
    />

    <div
      class="fixed inset-x-3 bottom-[calc(6.25rem+env(safe-area-inset-bottom))] z-50 max-h-[62vh] overflow-hidden border rounded-[28px] bg-background/96 shadow-2xl ring-1 ring-border/55 backdrop-blur-xl"
    >
      <div class="flex items-center justify-center px-4 pt-3">
        <div class="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
      </div>

      <div class="flex items-center justify-between gap-3 px-4 pb-3 pt-2">
        <div>
          <p class="text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
            {{ $t('sync.showStats') }}
          </p>
          <h3 class="pt-1 text-base text-foreground font-semibold">
            {{ props.selectedTab === 'selected' ? props.selectedLabel : props.currentLabel }}
          </h3>
        </div>

        <Button
          variant="ghost"
          size="icon"
          class="h-9 w-9 shrink-0 rounded-full text-muted-foreground"
          @click="closeDrawer"
        >
          <span class="i-lucide-x h-4 w-4" />
        </Button>
      </div>

      <div
        v-if="props.hasSelectedStatusPanel && props.hasCurrentStatusPanel"
        class="grid grid-cols-2 gap-2 px-4 pb-3"
      >
        <button
          type="button"
          class="h-10 rounded-full px-4 text-sm font-medium transition-colors"
          :class="props.selectedTab === 'selected'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'"
          @click="emit('update:selectedTab', 'selected')"
        >
          {{ props.selectedLabel }}
        </button>
        <button
          type="button"
          class="h-10 rounded-full px-4 text-sm font-medium transition-colors"
          :class="props.selectedTab === 'current'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'"
          @click="emit('update:selectedTab', 'current')"
        >
          {{ props.currentLabel }}
        </button>
      </div>

      <div class="max-h-[calc(62vh-8.5rem)] overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div
          v-if="props.selectedTab === 'selected' && props.hasSelectedStatusPanel"
        >
          <SyncStatsSummaryPanel
            :label="props.selectedLabel"
            :title="props.selectedTitle"
            :progress="props.selectedProgress"
            :total-count="props.selectedTotalCount"
            :synced-count="props.selectedSyncedCount"
            :unsynced-count="props.selectedUnsyncedCount"
            :has-error="props.selectedHasError"
          />
        </div>

        <div
          v-else-if="props.selectedTab === 'current' && props.hasCurrentStatusPanel"
          class="space-y-3"
        >
          <div v-if="props.currentLoading" class="space-y-3">
            <div class="h-6 w-40 animate-pulse rounded bg-muted" />
            <div class="h-10 w-24 animate-pulse rounded-full bg-muted" />
            <div class="h-12 animate-pulse rounded-[24px] bg-muted" />
            <div class="grid grid-cols-2 gap-2.5">
              <div class="col-span-2 h-28 animate-pulse rounded-2xl bg-muted" />
              <div class="h-28 animate-pulse rounded-2xl bg-muted" />
              <div class="h-28 animate-pulse rounded-2xl bg-muted" />
            </div>
          </div>

          <SyncStatsSummaryPanel
            v-else
            :label="props.currentLabel"
            :title="props.currentTitle"
            :subtitle="props.currentSubtitle"
            :progress="props.currentProgress"
            :total-count="props.currentTotalCount"
            :synced-count="props.currentSyncedCount"
            :unsynced-count="props.currentUnsyncedCount"
          />
        </div>
      </div>
    </div>
  </div>
</template>
