<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAuthStore } from '../store/useAuth'
import LoginPrompt from './ui/LoginPrompt.vue'

const props = defineProps<{
  requireAuth?: boolean
  redirectPath?: string
}>()

const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const router = useRouter()
const showPrompt = ref(false)

onMounted(() => {
  // 如果需要认证但未登录，显示提示或重定向
  if (props.requireAuth && !isLoggedIn.value) {
    showPrompt.value = true
  }
})
</script>

<template>
  <div>
    <!-- 如果已登录或不需要认证，显示内容 -->
    <slot v-if="!requireAuth || isLoggedIn" />
    
    <!-- 如果需要认证但未登录，显示登录提示 -->
    <LoginPrompt 
      v-if="requireAuth && !isLoggedIn && showPrompt" 
      :full-screen="true"
      :redirect-path="redirectPath"
    />
  </div>
</template> 