<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

defineProps<{
  fullScreen?: boolean
  redirectPath?: string
}>()

const router = useRouter()

function navigateToLogin() {
  router.push({
    path: '/login',
    query: { redirect: props.redirectPath || router.currentRoute.value.fullPath }
  })
}
</script>

<template>
  <div 
    class="flex flex-col items-center justify-center text-center"
    :class="{ 
      'h-full w-full fixed inset-0 bg-background/80 backdrop-blur-sm z-50': fullScreen,
      'p-8 rounded-lg border border-muted shadow-sm': !fullScreen,
    }"
  >
    <div class="max-w-md">
      <!-- 图标 -->
      <div class="flex justify-center mb-6">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <span class="i-lucide-lock text-3xl text-primary"></span>
        </div>
      </div>
      
      <!-- 标题和描述 -->
      <h3 class="text-xl font-semibold mb-2">请先登录</h3>
      <p class="text-muted-foreground mb-6">
        您需要登录才能访问此功能。登录后即可使用所有功能并同步您的 Telegram 聊天记录。
      </p>
      
      <!-- 按钮 -->
      <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button 
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          @click="navigateToLogin"
        >
          立即登录
        </button>
        <button 
          v-if="!fullScreen"
          class="px-4 py-2 bg-transparent hover:bg-muted text-foreground rounded-md transition-colors"
          @click="$emit('close')"
        >
          稍后再说
        </button>
      </div>
    </div>
  </div>
</template> 