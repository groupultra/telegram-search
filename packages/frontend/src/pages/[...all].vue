<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center">
    <div class="animate-bounce">
      <div class="text-8xl text-gray-800">
        <i class="fas fa-exclamation-circle" />
      </div>
      <h1 class="text-6xl text-gray-800 font-bold">
        404
      </h1>
    </div>
    <p class="mt-4 animate-fade-in text-xl text-gray-600">
      {{ t('pages.page_404.page_not_found') }}
    </p>
    <router-link
      to="/"
      class="mt-8 flex items-center gap-2 text-blue-500 transition-colors duration-200 hover:text-blue-600"
    >
      <i class="fas fa-home" />
      <span>{{ t('pages.page_404.return_to_home') }}</span>
    </router-link>
  </div>
</template>
