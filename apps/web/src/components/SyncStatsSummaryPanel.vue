<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { Progress } from './ui/Progress'
import { Skeleton } from './ui/Skeleton'
import { Statistic } from './ui/Statistic'
import { Tag } from './ui/Tag'

interface Props {
  label: string
  title: string
  progress: number
  totalCount: number
  syncedCount: number
  unsyncedCount: number
  subtitle?: string
  hasError?: boolean
  loading?: boolean
}

const props = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <!-- The one sync statistics block: used for the selection summary, the
       focused chat, and inside the mobile drawer. -->
  <div class="flex flex-col gap-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 flex flex-col gap-1">
        <p class="eyebrow">
          {{ props.label }}
        </p>
        <h3 class="truncate text-sm text-fg font-semibold leading-5">
          {{ props.title }}
        </h3>
        <p v-if="props.subtitle" class="truncate text-xs text-fg-3 leading-4">
          {{ props.subtitle }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-1">
        <Tag v-if="!props.loading" :color="props.hasError ? 'danger' : 'default'">
          {{ props.progress }}%
        </Tag>
        <slot name="actions" />
      </div>
    </div>

    <template v-if="props.loading">
      <Skeleton class="h-1.5 rounded-full" />
      <div class="grid grid-cols-3 gap-2">
        <Skeleton v-for="index in 3" :key="index" class="h-[3.75rem]" />
      </div>
    </template>

    <template v-else>
      <Progress :model-value="props.progress" />
      <div class="grid grid-cols-3 gap-2">
        <Statistic :label="t('sync.totalMessages')" :value="props.totalCount" />
        <Statistic :label="t('sync.syncedMessages')" :value="props.syncedCount" :tone="props.hasError ? 'danger' : 'default'" />
        <Statistic :label="t('sync.unsyncedMessages')" :value="props.unsyncedCount" tone="muted" />
      </div>
    </template>
  </div>
</template>
