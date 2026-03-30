<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from './ui/Button'
import { Progress } from './ui/Progress'

interface Props {
  etaMessage?: string
  errorMessage?: string
  hasError?: boolean
  progress: number
  statusMessage?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  abort: []
  dismiss: []
}>()

const { t } = useI18n()

const progressPercent = computed(() => {
  return Math.max(0, Math.min(100, Math.round(props.progress || 0)))
})

const progressHeight = computed(() => `${progressPercent.value}%`)
const remainingPercent = computed(() => Math.max(0, 100 - progressPercent.value))
</script>

<template>
  <div class="w-full flex flex-col border rounded-2xl bg-card/70 p-3.5 shadow-sm md:max-w-sm">
    <div class="mb-3 flex items-start gap-3">
      <div
        class="h-8 w-8 flex shrink-0 items-center justify-center rounded-lg"
        :class="props.hasError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'"
      >
        <span v-if="props.hasError" class="i-lucide-alert-circle h-4 w-4" />
        <span v-else class="i-lucide-loader-2 h-4 w-4 animate-spin" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-sm font-medium">
          {{ props.hasError ? t('sync.syncFailed') : t('sync.syncing') }}
        </h3>
        <p v-if="props.etaMessage && !props.hasError" class="text-xs text-muted-foreground">
          {{ props.etaMessage }}
        </p>
      </div>
      <div
        v-if="!props.hasError"
        class="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground font-medium tabular-nums"
      >
        {{ progressPercent }}%
      </div>
    </div>

    <div v-if="props.hasError" class="mb-3 break-words text-xs text-destructive">
      {{ props.errorMessage }}
    </div>
    <div v-else class="flex flex-1 flex-col">
      <div class="space-y-2">
        <div class="rounded-xl bg-muted/35 px-3 py-2">
          <div class="truncate text-sm text-foreground/90">
            {{ props.statusMessage }}
          </div>
        </div>
        <Progress :progress="props.progress" class="h-2 rounded-full bg-muted/70" />
      </div>

      <div class="mt-3 min-h-0 flex flex-1 gap-3">
        <div class="w-18 flex shrink-0 flex-col border border-border/60 rounded-xl bg-background/70 p-2.5">
          <div class="mb-2 text-center text-[11px] text-muted-foreground tracking-[0.16em] uppercase">
            {{ t('sync.syncProgress') }}
          </div>
          <div class="min-h-0 flex flex-1 items-end justify-center rounded-lg bg-muted/45 p-1.5">
            <div class="relative h-full w-full overflow-hidden rounded-md bg-background/80">
              <div
                class="absolute inset-x-0 bottom-0 rounded-md bg-emerald-500/75 transition-all duration-500 ease-out"
                :style="{ height: progressHeight }"
              />
            </div>
          </div>
          <div class="mt-2 text-center text-xs text-foreground font-medium tabular-nums">
            {{ progressPercent }}%
          </div>
        </div>

        <div class="min-w-0 flex flex-1 flex-col justify-between border border-border/60 rounded-xl bg-background/70 p-3">
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-muted-foreground">{{ t('sync.completedRatio') }}</span>
              <span class="text-sm text-foreground font-semibold tabular-nums">
                {{ progressPercent }}%
              </span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="text-xs text-muted-foreground">{{ t('sync.remainingRatio') }}</span>
              <span class="text-sm text-foreground font-semibold tabular-nums">
                {{ remainingPercent }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-3 flex items-center justify-end gap-2">
      <Button
        v-if="props.hasError"
        variant="outline"
        size="sm"
        class="h-7 text-xs"
        @click="emit('dismiss')"
      >
        {{ t('sync.dismiss') }}
      </Button>
      <Button
        v-else
        variant="outline"
        size="sm"
        class="h-7 text-xs"
        @click="emit('abort')"
      >
        {{ t('sync.cancel') }}
      </Button>
    </div>
  </div>
</template>
