<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import DefaultLayout from './layouts/default.vue'
</script>

<template>
  <div class="min-h-screen bg-white transition-all duration-300 ease-in-out dark:bg-gray-900">
    <Toaster position="top-right" :expand="true" :rich-colors="true" />
    <DefaultLayout>
      <router-view />
    </DefaultLayout>
  </div>
</template>
