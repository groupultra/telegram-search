<script setup lang="ts">
import { LOGIN_GRADIENT_TITLE_CLASS } from '../../pages/login/styles'

defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="relative isolate min-h-[100dvh] flex items-center justify-center overflow-hidden p-4 font-sans">
    <div
      class="[animation-duration:800ms] [animation-timing-function:cubic-bezier(0.16,1,0.3,1)] relative z-10 max-w-md w-full animate-in overflow-hidden border border-border/60 rounded-3xl bg-card/95 px-6 py-10 shadow-2xl backdrop-blur-xl fade-in zoom-in-95 slide-in-from-bottom-4 md:px-12 md:py-12"
    >
      <div class="mb-8 text-center">
        <div class="mx-auto mb-6 h-16 w-16 flex items-center justify-center rounded-2xl from-primary/20 to-primary/5 bg-gradient-to-br text-primary shadow-inner ring-1 ring-border/50">
          <span :class="icon" class="h-8 w-8" />
        </div>
        <h1 :class="`text-2xl md:text-3xl ${LOGIN_GRADIENT_TITLE_CLASS}`">
          {{ title }}
        </h1>
        <p v-if="description" class="mt-3 text-base text-muted-foreground/80">
          {{ description }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>
