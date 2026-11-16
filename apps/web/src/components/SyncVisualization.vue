<script setup lang="ts">
import type { ChatSyncStats } from '@tg-search/core'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SyncStatsSummaryPanel from './SyncStatsSummaryPanel.vue'

import { ActionIcon } from './ui/ActionIcon'
import { Button } from './ui/Button'
import { Empty } from './ui/Empty'

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
</script>

<template>
  <SyncStatsSummaryPanel
    v-if="stats || loading"
    :label="t('sync.currentChatLabel')"
    :title="t('sync.syncVisualization')"
    :subtitle="props.chatLabel"
    :progress="syncPercentage"
    :total-count="totalCount"
    :synced-count="syncedCount"
    :unsynced-count="unsyncedCount"
    :loading="loading && !stats"
  >
    <template #actions>
      <Button v-if="props.showAbort" size="sm" @click="emit('abort')">
        {{ t('common.cancel') }}
      </Button>
      <ActionIcon v-if="props.showClose" icon="i-lucide-x" size="sm" @click="emit('close')" />
    </template>
  </SyncStatsSummaryPanel>

  <Empty v-else :title="t('sync.selectChats')" />
</template>
