<script setup lang="ts">
import type { SyncOptions } from '@tg-search/core'
import type { DateRange } from 'reka-ui'

import {
  DateRangePickerCalendar,
  DateRangePickerCell,
  DateRangePickerCellTrigger,
  DateRangePickerContent,
  DateRangePickerGrid,
  DateRangePickerGridBody,
  DateRangePickerGridHead,
  DateRangePickerGridRow,
  DateRangePickerHeadCell,
  DateRangePickerHeader,
  DateRangePickerHeading,
  DateRangePickerNext,
  DateRangePickerPrev,
  DateRangePickerRoot,
  DateRangePickerTrigger,
} from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  formatRangeLabel,
  sameRange,
  toDateRange,
  toTimestampMs,
} from '../utils/date-range'

const syncOptions = defineModel<SyncOptions>({ default: () => ({ syncMedia: true, maxMediaSize: 0 }) })

const { t } = useI18n()

// Local state
const syncMedia = ref(syncOptions.value.syncMedia ?? true)
const maxMediaSize = ref(syncOptions.value.maxMediaSize ?? 0)
const minMessageId = ref(syncOptions.value.minMessageId ?? undefined)
const maxMessageId = ref(syncOptions.value.maxMessageId ?? undefined)
const timeRange = shallowRef<DateRange>(toDateRange(syncOptions.value.startTime, syncOptions.value.endTime))

const formattedRangeLabel = computed(() => {
  return formatRangeLabel(timeRange.value)
})

watch(
  () => [syncOptions.value.startTime, syncOptions.value.endTime] as const,
  ([start, end]) => {
    const nextRange = toDateRange(start, end)
    if (!sameRange(nextRange, timeRange.value))
      timeRange.value = nextRange
  },
)

// Update model when local state changes
watch([syncMedia, maxMediaSize, timeRange, minMessageId, maxMessageId], () => {
  syncOptions.value = {
    syncMedia: syncMedia.value,
    maxMediaSize: maxMediaSize.value,
    startTime: toTimestampMs(timeRange.value.start),
    endTime: toTimestampMs(timeRange.value.end),
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
          <DateRangePickerRoot
            v-model="timeRange"
            :number-of-months="2"
            :close-on-select="false"
            granularity="minute"
          >
            <DateRangePickerTrigger as-child>
              <button
                type="button"
                class="w-full flex items-center justify-between gap-3 border border-input rounded-md bg-background px-3 py-2 text-left text-sm ring-offset-background transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                <div class="flex flex-col">
                  <span class="text-xs text-muted-foreground">
                    {{ t('sync.startTime') }} / {{ t('sync.endTime') }}
                  </span>
                  <span class="text-sm text-foreground font-medium">
                    {{ formattedRangeLabel }}
                  </span>
                </div>
                <span class="i-lucide-calendar h-4 w-4 text-muted-foreground" />
              </button>
            </DateRangePickerTrigger>

            <DateRangePickerContent
              align="start"
              class="z-[210] max-w-[95vw] w-[640px] border rounded-lg bg-popover p-3 text-popover-foreground shadow-lg"
            >
              <DateRangePickerCalendar v-slot="{ weekDays, grid }">
                <div class="space-y-3">
                  <DateRangePickerHeader class="flex items-center justify-between">
                    <DateRangePickerPrev class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                      <span class="i-lucide-chevron-left h-4 w-4" />
                    </DateRangePickerPrev>
                    <DateRangePickerHeading class="text-sm font-medium" />
                    <DateRangePickerNext class="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent">
                      <span class="i-lucide-chevron-right h-4 w-4" />
                    </DateRangePickerNext>
                  </DateRangePickerHeader>

                  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DateRangePickerGrid
                      v-for="month in grid"
                      :key="month.value.toString()"
                      class="w-full border-separate border-spacing-1"
                    >
                      <DateRangePickerGridHead>
                        <DateRangePickerGridRow>
                          <DateRangePickerHeadCell
                            v-for="day in weekDays"
                            :key="day"
                            class="h-8 w-9 text-center text-xs text-muted-foreground font-medium"
                          >
                            {{ day }}
                          </DateRangePickerHeadCell>
                        </DateRangePickerGridRow>
                      </DateRangePickerGridHead>
                      <DateRangePickerGridBody>
                        <DateRangePickerGridRow v-for="(week, wi) in month.rows" :key="`week-${wi}`">
                          <DateRangePickerCell
                            v-for="dateValue in week"
                            :key="dateValue.toString()"
                            :date="dateValue"
                          >
                            <DateRangePickerCellTrigger
                              :day="dateValue"
                              :month="month.value"
                              class="h-9 w-9 flex items-center justify-center rounded-md text-sm outline-none transition-colors data-[highlighted]:bg-primary/15 data-[selected]:bg-primary data-[selection-end]:bg-primary data-[selection-start]:bg-primary hover:bg-accent/60 data-[outside-view]:text-muted-foreground data-[selected]:text-primary-foreground data-[selection-end]:text-primary-foreground data-[selection-start]:text-primary-foreground data-[disabled]:opacity-40"
                            />
                          </DateRangePickerCell>
                        </DateRangePickerGridRow>
                      </DateRangePickerGridBody>
                    </DateRangePickerGrid>
                  </div>
                </div>
              </DateRangePickerCalendar>
            </DateRangePickerContent>
          </DateRangePickerRoot>
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
