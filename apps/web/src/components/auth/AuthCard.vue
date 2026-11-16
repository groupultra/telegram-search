<script setup lang="ts">
import { LOGIN_TITLE_CLASS } from '../../pages/login/styles'

defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="min-h-[100dvh] w-full flex items-center justify-center bg-background p-6 font-sans">
    <div class="max-w-sm w-full animate-in duration-500 fade-in slide-in-from-bottom-2">
      <div class="mb-8">
        <div class="mb-8 h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <span :class="icon" class="h-5 w-5" />
        </div>
        <h1 :class="`text-2xl ${LOGIN_TITLE_CLASS}`">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-2 text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>
