<script setup lang="ts">
import type { ChatSyncStats } from '@tg-search/core'
import type { BarSeriesOption } from 'echarts/charts'
import type { EChartsOption } from 'echarts/types/dist/shared'

import VChart from 'vue-echarts'

import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<Props>()

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const { t } = useI18n()

interface Props {
  stats?: ChatSyncStats
  loading?: boolean
  chatLabel?: string
}

const isOpen = ref(true)

function toggleOpen() {
  isOpen.value = !isOpen.value
}

const chartOption = computed<EChartsOption>(() => {
  const syncedCount = props.stats?.syncedMessages ?? 0
  const unsyncedCount = props.stats ? Math.max(0, props.stats.totalMessages - props.stats.syncedMessages) : 0

  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      bottom: 0,
      data: [t('sync.syncedMessages'), t('sync.unsyncedMessages')],
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      top: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: t('sync.totalMessages'),
    },
    yAxis: {
      type: 'category',
      data: [t('sync.syncProgress')],
    },
    series: [
      {
        name: t('sync.syncedMessages'),
        type: 'bar',
        stack: 'total',
        data: [syncedCount],
        itemStyle: {
          color: 'rgba(34, 197, 94, 0.8)',
        },
        emphasis: {
          itemStyle: {
            color: 'rgba(34, 197, 94, 1)',
          },
        },
      } as BarSeriesOption,
      {
        name: t('sync.unsyncedMessages'),
        type: 'bar',
        stack: 'total',
        data: [unsyncedCount],
        itemStyle: {
          color: 'rgba(229, 231, 235, 0.8)',
        },
        emphasis: {
          itemStyle: {
            color: 'rgba(229, 231, 235, 1)',
          },
        },
      } as BarSeriesOption,
    ],
  }
})

const syncPercentage = computed(() => {
  if (!props.stats || props.stats.totalMessages === 0)
    return 0
  return Math.round((props.stats.syncedMessages / props.stats.totalMessages) * 100)
})
</script>

<template>
  <div class="space-y-3">
    <button
      type="button"
      class="w-full flex items-center justify-between text-left"
      @click="toggleOpen"
    >
      <div class="space-y-1">
        <h3 class="text-base text-foreground font-semibold">
          {{ t('sync.syncVisualization') }}
        </h3>
        <p v-if="props.chatLabel" class="text-xs text-muted-foreground">
          {{ props.chatLabel }}
        </p>
      </div>

      <div class="flex items-center gap-3">
        <span v-if="stats" class="text-xs text-muted-foreground">
          {{ t('sync.syncProgress') }}:
          <span class="text-foreground font-medium">{{ syncPercentage }}%</span>
        </span>
        <span
          :class="isOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
          class="h-4 w-4 text-muted-foreground transition-transform duration-200"
        />
      </div>
    </button>

    <Transition name="collapse-vertical">
      <div v-show="isOpen" class="space-y-4">
        <!-- Skeleton while loading chat stats -->
        <div v-if="loading && !stats" class="space-y-4">
          <div class="grid grid-cols-3 gap-4">
            <div class="h-16 animate-pulse rounded-lg bg-muted" />
            <div class="h-16 animate-pulse rounded-lg bg-muted" />
            <div class="h-16 animate-pulse rounded-lg bg-muted" />
          </div>

          <div class="space-y-2">
            <div class="h-4 w-24 animate-pulse rounded bg-muted" />
            <div class="h-3 w-full animate-pulse rounded-full bg-muted" />
          </div>

          <div class="h-32 animate-pulse rounded-lg bg-muted" />
        </div>

        <div v-else-if="stats" class="space-y-4">
          <!-- Stats Summary -->
          <div class="grid grid-cols-3 gap-4">
            <div class="rounded-lg bg-muted p-4 text-center">
              <div class="text-2xl text-foreground font-bold">
                {{ stats.totalMessages }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ t('sync.totalMessages') }}
              </div>
            </div>
            <div class="rounded-lg bg-green-100 p-4 text-center dark:bg-green-900/20">
              <div class="text-2xl text-green-700 font-bold dark:text-green-400">
                {{ stats.syncedMessages }}
              </div>
              <div class="text-xs text-green-600 dark:text-green-500">
                {{ t('sync.syncedMessages') }}
              </div>
            </div>
            <div class="rounded-lg bg-gray-100 p-4 text-center dark:bg-gray-800">
              <div class="text-2xl text-gray-700 font-bold dark:text-gray-300">
                {{ Math.max(0, stats.totalMessages - stats.syncedMessages) }}
              </div>
              <div class="text-xs text-gray-600 dark:text-gray-400">
                {{ t('sync.unsyncedMessages') }}
              </div>
            </div>
          </div>

          <!-- Chart -->
          <div class="h-32">
            <VChart :option="chartOption" autoresize />
          </div>
        </div>

        <div v-else class="py-8 text-center text-sm text-muted-foreground">
          {{ t('sync.selectChats') }}
        </div>
      </div>
    </Transition>
  </div>
</template>
