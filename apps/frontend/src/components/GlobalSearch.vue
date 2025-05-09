<script setup lang="ts">
import type { CoreMessage } from '@tg-search/core'

import { useClipboard } from '@vueuse/core'
import { computed, ref } from 'vue'

import Avatar from './ui/Avatar.vue'

interface Props {
  messages: CoreMessage[]
  placeholder?: string
  filter?: (message: CoreMessage, keyword: string) => boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '搜索消息内容...',
  filter: (message: CoreMessage, keyword: string) => message.content.includes(keyword),
})

const emit = defineEmits<{
  (e: 'blur'): void
}>()
const keyword = ref<string>('')
const showSettings = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const hoveredMessage = ref<CoreMessage | null>(null)
const { copy, copied } = useClipboard()

// 高亮关键词函数
function highlightKeyword(text: string, keyword: string) {
  if (!keyword)
    return text
  const regex = new RegExp(`(${keyword})`, 'gi')
  return text.replace(regex, '<span class="bg-yellow-200 dark:bg-yellow-800">$1</span>')
}

function copyMessage(message: CoreMessage) {
  copy(message.content)
}

function focus() {
  searchInputRef.value?.focus()
}

function blur() {
  searchInputRef.value?.blur()
  emit('blur')
}

const search_result = computed(() => {
  if (keyword.value === '') {
    return []
  }

  return props.messages.filter((message) => {
    if (!message || !message.content)
      return false
    return props.filter(message, keyword.value)
  })
})

// 暴露给父组件的方法和属性
defineExpose({
  keyword,
  showSettings,
  search_result,
  focus,
  blur,
})
</script>

<template>
  <div class="flex items-center justify-center">
    <div class="w-[45%] bg-card rounded-xl shadow-lg border border-border">
      <!-- 搜索输入框 -->
      <div class="px-4 py-3 border-b border-border flex items-center gap-2">
        <input
          ref="searchInputRef"
          v-model="keyword"
          class="w-full outline-none text-foreground"
          :placeholder="placeholder"
          @blur="blur"
        >
        <button
          class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-foreground hover:bg-muted"
          @click="showSettings = !showSettings"
        >
          <span class="i-lucide-chevron-down h-4 w-4 transition-transform" :class="{ 'rotate-180': showSettings }" />
        </button>
      </div>

      <!-- 设置栏 -->
      <div v-if="showSettings" class="px-4 py-3 border-b border-border">
        <slot />
      </div>

      <!-- 搜索结果 -->
      <div
        v-show="keyword"
        class="p-4 min-h-[200px] transition-all duration-300 ease-in-out"
        :class="{ 'opacity-0': !keyword, 'opacity-100': keyword }"
      >
        <template v-if="search_result.length > 0">
          <ul class="flex flex-col max-h-[540px] overflow-y-auto scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent animate-fade-in">
            <li
              v-for="item in search_result"
              :key="item.uuid"
              class="flex items-center gap-2 p-2 border-b border-border last:border-b-0 hover:bg-muted/50 transition-all duration-200 ease-in-out animate-slide-in relative group cursor-pointer"
              tabindex="0"
              @mouseenter="hoveredMessage = item"
              @mouseleave="hoveredMessage = null"
              @keydown.enter="copyMessage(item)"
            >
              <Avatar
                :name="item.fromName"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-semibold text-foreground truncate">
                  {{ item.fromName }}
                </div>
                <div class="text-sm text-muted-foreground break-words" v-html="highlightKeyword(item.content, keyword)" />
              </div>
              <div
                v-if="hoveredMessage === item"
                class="absolute bottom-0.5 right-0.5 text-[10px] text-muted-foreground flex items-center gap-0.5 opacity-50 bg-background/50 px-1 py-0.5 rounded"
              >
                <span>{{ copied ? '已复制' : '按下' }}</span>
                <span v-if="!copied" class="i-lucide-corner-down-left h-2.5 w-2.5" />
                <span v-else class="i-lucide-check h-2.5 w-2.5" />
                <span v-if="!copied">复制</span>
              </div>
            </li>
          </ul>
        </template>
        <template v-else>
          <div class="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-70">
            <span class="i-lucide-search text-3xl mb-2" />
            <span>没有找到相关消息</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.3s ease-out;
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
</style>
