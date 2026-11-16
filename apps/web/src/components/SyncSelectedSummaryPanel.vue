<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  label: string
  title: string
  progress: number
  totalCount: number
  syncedCount: number
  unsyncedCount: number
  hasError?: boolean
}

const props = defineProps<Props>()

const { t } = useI18n()
</script>

<template>
  <div class="flex border-b border-border/50 p-3 pt-3 md:min-h-[260px] md:border-b-0 md:border-r md:p-4 md:pt-3">
    <div class="min-w-0 flex flex-1">
      <div class="grid w-full gap-3">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] text-muted-foreground tracking-wider uppercase">
              {{ props.label }}
            </p>
            <h3 class="truncate pt-1 text-lg text-foreground font-semibold">
              {{ props.title }}
            </h3>
          </div>
          <div class="shrink-0 border border-border/60 rounded-full bg-background/70 px-3 py-1 text-sm text-foreground font-semibold tabular-nums">
            {{ props.progress }}%
          </div>
        </div>

        <div class="min-h-0 flex flex-1 gap-3 md:gap-4.5">
          <div class="w-14 flex shrink-0 md:w-20">
            <div class="relative h-full min-h-[152px] w-full overflow-hidden rounded-lg bg-muted ring-1 ring-border md:min-h-[208px]">
              <div
                class="absolute inset-x-0 bottom-0 bg-primary transition-all duration-500 ease-out"
                :style="{ height: `${props.progress}%` }"
              />
            </div>
          </div>

          <div class="grid min-w-0 flex-1 gap-2">
            <div class="rounded-lg bg-transparent px-4 py-2.5 ring-1 ring-border">
              <div class="text-[11px] text-muted-foreground tracking-wider uppercase">
                {{ t('sync.totalMessages') }}
              </div>
              <div class="pt-1.5 text-[1.6rem] text-foreground font-semibold leading-none tabular-nums md:text-[2rem]">
                {{ props.totalCount }}
              </div>
            </div>

            <div
              class="rounded-lg px-4 py-2.5 ring-1"
              :class="props.hasError
                ? 'bg-destructive/8 ring-destructive/20'
                : 'bg-transparent ring-border'"
            >
              <div
                class="text-[11px] tracking-wider uppercase"
                :class="props.hasError ? 'text-destructive' : 'text-foreground '"
              >
                {{ t('sync.syncedMessages') }}
              </div>
              <div
                class="pt-1.5 text-[1.6rem] font-semibold leading-none tabular-nums md:text-[2rem]"
                :class="props.hasError ? 'text-destructive' : 'text-foreground '"
              >
                {{ props.syncedCount }}
              </div>
            </div>

            <div class="rounded-lg bg-transparent px-4 py-2.5 ring-1 ring-border">
              <div class="text-[11px] text-muted-foreground tracking-wider uppercase">
                {{ t('sync.unsyncedMessages') }}
              </div>
              <div class="pt-1.5 text-[1.6rem] text-muted-foreground font-semibold leading-none tabular-nums md:text-[2rem]">
                {{ props.unsyncedCount }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
