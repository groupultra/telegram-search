<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { toast } from 'vue-sonner'
import { useEmbed } from '../../apis/commands/useEmbed'
import EmbedStatus from '../../components/embed/EmbedStatus.vue'
import NeedLogin from '../../components/NeedLogin.vue'
import ChatSelector from '../../components/sync/ChatSelector.vue'
import { useSession } from '../../composables/useSession'
import { useChats } from '../../store/useChats'

const { t } = useI18n()
const chatStore = useChats()
const { loadChats, exportedChats } = chatStore
const { executeEmbed, currentCommand, embedProgress, cleanup } = useEmbed()
const { checkConnection } = useSession()
const { isConnected } = storeToRefs(useSession())

const selectedChats = ref<number[]>([])
const showConnectButton = ref(false)
const waitingTimeLeft = ref(0)
const isProcessing = ref(false)

// 配置选项
const batchSize = ref(1000)
const concurrency = ref(4)

const commandProgress = computed(() => embedProgress.value || 0)

// 验证输入
function validateInputs() {
  if (batchSize.value < 1 || batchSize.value > 10000) {
    toast.error(t('component.embed_command.batch_size_tip'))
    return false
  }
  if (concurrency.value < 1 || concurrency.value > 10) {
    toast.error(t('component.embed_command.concurrency_tip'))
    return false
  }
  return true
}

async function startEmbed() {
  if (!isConnected.value) {
    toast.error(t('component.embed_command.not_connect'))
    return
  }

  if (selectedChats.value.length === 0) {
    toast.error(t('component.embed_command.no_chat_selected'))
    return
  }

  if (!validateInputs()) {
    return
  }

  isProcessing.value = true
  cleanup() // 清理之前的状态

  // 为每个选中的聊天生成向量嵌入
  for (const chatId of selectedChats.value) {
    const toastId = toast.loading(t('component.embed_command.prepare_embed'))

    try {
      const result = await executeEmbed({
        chatId,
        batchSize: batchSize.value,
        concurrency: concurrency.value,
      })

      if (result.success) {
        toast.success(t('component.embed_command.embed_success'), { id: toastId })
      }
      else {
        const errorMessage = String(result.error || t('component.embed_command.embed_error'))
        toast.error(errorMessage, { id: toastId })
      }
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      toast.error(t('component.embed_command.embed_failure', { error: errorMessage }), { id: toastId })
      console.error('Failed to start embed:', error)
    }
  }

  isProcessing.value = false
}

// Watchers
watch(() => currentCommand.value?.status, (status) => {
  if (status === 'waiting' && currentCommand.value?.metadata?.waitTime) {
    waitingTimeLeft.value = Math.ceil(currentCommand.value.metadata.waitTime as number / 1000)
    const waitTimer = setInterval(() => {
      if (waitingTimeLeft.value <= 0) {
        clearInterval(waitTimer)
        return
      }
      waitingTimeLeft.value--
    }, 1000)
  }
})

// 清理函数
function resetState() {
  cleanup()
  selectedChats.value = []
  batchSize.value = 1000
  concurrency.value = 4
  waitingTimeLeft.value = 0
  isProcessing.value = false
}

// Lifecycle
onMounted(async () => {
  loadChats()
  const connected = await checkConnection(false)
  if (!connected)
    showConnectButton.value = true
})

// 组件卸载时清理
onUnmounted(() => {
  resetState()
})
</script>

<template>
  <div class="space-y-4">
    <NeedLogin :is-connected="isConnected" />

    <div class="flex items-center justify-between">
      <h3 class="text-lg font-medium">
        {{ t('component.embed_command.select_chats') }}
      </h3>
      <div class="flex items-center gap-4">
        <!-- Batch Size Input -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 dark:text-gray-300">
            {{ t('component.embed_command.batch_size') }}
            <span class="text-xs text-gray-400">
              (1-10000)
            </span>
          </label>
          <input
            v-model="batchSize"
            type="number"
            min="1"
            max="10000"
            class="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            :disabled="isProcessing"
          >
        </div>

        <!-- Concurrency Input -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-gray-600 dark:text-gray-300">
            {{ t('component.embed_command.concurrency') }}
            <span class="text-xs text-gray-400">
              (1-10)
            </span>
          </label>
          <input
            v-model="concurrency"
            type="number"
            min="1"
            max="10"
            class="w-16 border border-gray-300 rounded-md px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            :disabled="isProcessing"
          >
        </div>

        <span class="text-sm text-gray-500">
          {{ t('component.sync_command.selected_count', { count: selectedChats.length }) }}
        </span>
        <button
          class="rounded-md bg-blue-500 px-4 py-2 text-white disabled:cursor-not-allowed hover:bg-blue-600 disabled:opacity-50"
          :disabled="selectedChats.length === 0 || !isConnected || isProcessing"
          @click="startEmbed"
        >
          <span v-if="isProcessing" class="flex items-center gap-2">
            <div class="i-lucide-loader h-4 w-4 animate-spin" />
            {{ t('component.embed_command.running') }}
          </span>
          <span v-else>
            {{ t('component.embed_command.start_embed') }}
          </span>
        </button>
      </div>
    </div>

    <ChatSelector
      v-model:selected-chats="selectedChats"
      :chats="exportedChats"
      :disabled="isProcessing"
    />

    <!-- Embed Status -->
    <EmbedStatus
      :command="currentCommand"
      :progress="commandProgress"
      :waiting-time-left="waitingTimeLeft"
    />
  </div>
</template>
