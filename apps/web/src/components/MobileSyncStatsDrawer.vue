<script setup lang="ts">
import SyncStatsSummaryPanel from './SyncStatsSummaryPanel.vue'

import { ActionIcon } from './ui/ActionIcon'
import { Segmented } from './ui/Segmented'

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
      class="fixed inset-0 z-40 bg-mask"
      @click="closeDrawer"
    />

    <div
      class="fixed inset-x-0 bottom-0 z-50 max-h-[70vh] flex flex-col gap-3 overflow-hidden rounded-t-lg bg-elevated p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-fg shadow-modal"
    >
      <div class="mx-auto h-1 w-9 shrink-0 rounded-full bg-fill" />

      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm text-fg font-semibold leading-6">
          {{ $t('sync.showStats') }}
        </h3>
        <ActionIcon icon="i-lucide-x" @click="closeDrawer" />
      </div>

      <Segmented
        v-if="props.hasSelectedStatusPanel && props.hasCurrentStatusPanel"
        :model-value="props.selectedTab"
        :options="[
          { value: 'selected', label: props.selectedLabel },
          { value: 'current', label: props.currentLabel },
        ]"
        block
        @update:model-value="emit('update:selectedTab', $event)"
      />

      <div class="min-h-0 overflow-y-auto">
        <SyncStatsSummaryPanel
          v-if="props.selectedTab === 'selected' && props.hasSelectedStatusPanel"
          :label="props.selectedLabel"
          :title="props.selectedTitle"
          :progress="props.selectedProgress"
          :total-count="props.selectedTotalCount"
          :synced-count="props.selectedSyncedCount"
          :unsynced-count="props.selectedUnsyncedCount"
          :has-error="props.selectedHasError"
        />

        <SyncStatsSummaryPanel
          v-else-if="props.selectedTab === 'current' && props.hasCurrentStatusPanel"
          :label="props.currentLabel"
          :title="props.currentTitle"
          :subtitle="props.currentSubtitle"
          :progress="props.currentProgress"
          :total-count="props.currentTotalCount"
          :synced-count="props.currentSyncedCount"
          :unsynced-count="props.currentUnsyncedCount"
          :loading="props.currentLoading"
        />
      </div>
    </div>
  </div>
</template>
