<script setup lang="ts">
import { computed, onMounted } from 'vue'

import GlobalSearch from '../components/GlobalSearch.vue'
import { useChatStore } from '../store/useChat'
import { useMessageStore } from '../store/useMessage'

const { init } = useChatStore()
const { messagesByChat, fetchMessagesWithDatabase } = useMessageStore()

onMounted(() => {
  init()
  fetchMessagesWithDatabase('1337397962', { offset: 0, limit: 40 })
})

const messages = computed(() => {
  const msgs = messagesByChat.get('1337397962')
  return msgs ? Array.from(msgs.values()) : []
})
</script>

<template>
  <GlobalSearch
    :messages="messages" :filter="(message, keyword) => {
      if (keyword === '')
        return true
      console.log();

      return message.content.includes(keyword)
    }"
  >
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <input id="searchContent" type="checkbox" class="rounded border-border">
        <label for="searchContent" class="text-sm text-foreground">搜索内容</label>
      </div>
      <div class="flex items-center gap-2">
        <input id="searchName" type="checkbox" class="rounded border-border">
        <label for="searchName" class="text-sm text-foreground">搜索用户名</label>
      </div>
      <div class="flex items-center gap-2">
        <input id="searchName" type="checkbox" class="rounded border-border">
        <label for="searchName" class="text-sm text-foreground">语义搜索</label>
      </div>
    </div>
  </GlobalSearch>
</template>
