<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description?: string
}>()
</script>

<template>
  <!-- Shared frame for every signed-out screen: Telegram login and the server-auth pages. -->
  <div class="min-h-[100dvh] w-full flex items-center justify-center bg-layout p-4 font-sans">
    <div class="max-w-sm w-full flex flex-col animate-in gap-6 rounded-lg bg-container p-6 shadow-[var(--shadow-sm),var(--ring-line)] duration-300 fade-in slide-in-from-bottom-2">
      <div class="flex flex-col gap-4">
        <div class="h-10 w-10 flex items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span :class="icon" class="h-5 w-5" />
        </div>
        <div class="flex flex-col gap-1">
          <h1 class="text-xl text-fg font-semibold leading-7">
            {{ title }}
          </h1>
          <p v-if="description" class="text-sm text-fg-2">
            {{ description }}
          </p>
        </div>
      </div>
      <slot />
    </div>
  </div>
</template>
