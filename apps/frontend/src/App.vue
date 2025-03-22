<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import { createWebsocketV2Context } from './composables/useWebsocketV2'
import DefaultLayout from './layouts/default.vue'

interface AccountCtx {
  sessionId: string
  socket: ReturnType<typeof createWebsocketV2Context>['socket']
}

const account = new Map<string, AccountCtx>()

const { socket } = createWebsocketV2Context()


</script>

<template>
  <div class="min-h-screen bg-white transition-all duration-300 ease-in-out dark:bg-gray-900">
    <Toaster position="top-right" :expand="true" :rich-colors="true" />
    <DefaultLayout>
      <router-view />
    </DefaultLayout>
  </div>
</template>
