<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  label: string
  title: string
  progress: number
  totalCount: number
  syncedCount: number
  unsyncedCount: number
  subtitle?: string
  hasError?: boolean
}

const props = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
          {{ props.label }}
        </p>
        <h3 class="truncate pt-1 text-lg text-foreground font-semibold">
          {{ props.title }}
        </h3>
        <p v-if="props.subtitle" class="truncate pt-1 text-sm text-muted-foreground">
          {{ props.subtitle }}
        </p>
      </div>
      <div class="shrink-0 border border-border/60 rounded-full bg-background/70 px-3 py-1 text-sm text-foreground font-semibold tabular-nums">
        {{ props.progress }}%
      </div>
    </div>

    <div class="relative overflow-hidden rounded-[24px] bg-foreground/8 p-3 ring-1 ring-border/55">
      <div class="relative h-12 w-full flex overflow-hidden rounded-[20px]">
        <div
          class="min-w-0 flex items-center justify-center bg-emerald-500/75 px-3 text-sm text-emerald-950 font-semibold transition-all duration-500 ease-out dark:text-emerald-50"
          :style="{ width: `${props.progress}%` }"
        >
          <span v-if="props.syncedCount > 0" class="truncate tabular-nums">
            {{ props.syncedCount }}
          </span>
        </div>
        <div
          class="min-w-0 flex items-center justify-center bg-slate-300/80 px-3 text-sm text-slate-700 font-semibold transition-all duration-500 ease-out dark:bg-slate-200/70 dark:text-slate-900"
          :style="{ width: `${Math.max(0, 100 - props.progress)}%` }"
        >
          <span v-if="props.unsyncedCount > 0" class="truncate tabular-nums">
            {{ props.unsyncedCount }}
          </span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-2.5">
      <div class="col-span-2 rounded-2xl bg-background/55 px-4 py-3 ring-1 ring-border/55">
        <div class="text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
          {{ t('sync.totalMessages') }}
        </div>
        <div class="pt-2 text-[2rem] text-foreground font-semibold leading-none tabular-nums">
          {{ props.totalCount }}
        </div>
      </div>

      <div
        class="rounded-2xl px-4 py-3 ring-1"
        :class="props.hasError
          ? 'bg-destructive/8 ring-destructive/20'
          : 'bg-emerald-500/8 ring-emerald-500/20'"
      >
        <div
          class="text-[11px] tracking-[0.16em] uppercase"
          :class="props.hasError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ t('sync.syncedMessages') }}
        </div>
        <div
          class="pt-2 text-[1.8rem] font-semibold leading-none tabular-nums"
          :class="props.hasError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'"
        >
          {{ props.syncedCount }}
        </div>
      </div>

      <div class="rounded-2xl bg-slate-300/10 px-4 py-3 ring-1 ring-slate-300/20 dark:bg-slate-500/8 dark:ring-slate-400/20">
        <div class="text-[11px] text-slate-500 tracking-[0.16em] uppercase dark:text-slate-400">
          {{ t('sync.unsyncedMessages') }}
        </div>
        <div class="pt-2 text-[1.8rem] text-slate-500 font-semibold leading-none tabular-nums dark:text-slate-300">
          {{ props.unsyncedCount }}
        </div>
      </div>
    </div>
  </div>
</template>
