<script lang="ts" setup>
import type { DialogType } from '@tg-search/core'

import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterView } from 'vue-router'

import ChatsCollapse from '../components/layout/ChatsCollapse.vue'
import SettingsDialog from '../components/layout/SettingsDialog.vue'
import SidebarSelector from '../components/layout/SidebarSelector.vue'
import { Button } from '../components/ui/Button'
import { useChatStore } from '../store/useChat'
import { useSessionStore } from '../store/useSession'
import { useSettingsStore } from '../store/useSettings'

const settingsStore = useSettingsStore()
const { theme } = storeToRefs(settingsStore)
const isDark = useDark()

const sessionStore = useSessionStore()

const settingsDialog = ref(false)
const searchParams = ref('')

const chatStore = useChatStore()
const chats = computed(() => chatStore.chats)
const chatsFiltered = computed(() => {
  return chats.value.filter(chat => chat.name.toLowerCase().includes(searchParams.value.toLowerCase()))
})

type ChatGroup = DialogType | ''
const activeChatGroup = ref<ChatGroup>('user')

watch(theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
}, { immediate: true })

function toggleSettingsDialog() {
  settingsDialog.value = !settingsDialog.value
}

function toggleActiveChatGroup(group: ChatGroup) {
  if (activeChatGroup.value === group)
    activeChatGroup.value = 'user'
  else
    activeChatGroup.value = group
}
</script>

<template>
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
  >
    <div class="w-[20%] md:w-[15%] flex flex-col h-dvh border-r border-r-secondary">
      <div class="relative p-4">
        <div
          class="i-lucide-search absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4"
        />
        <input
          v-model="searchParams"
          type="text"
          class="w-full border border-secondary rounded-md bg-muted px-3 py-2 pl-9  ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring dark:border-secondary dark:bg-muted"
          placeholder="Search"
        >
      </div>

      <div class="mb-4">
        <SidebarSelector
          path="/"
          icon="i-lucide-home"
          name="主页"
        />

        <SidebarSelector
          path="/sync"
          icon="i-lucide-refresh-cw"
          name="同步"
        />

        <SidebarSelector
          path="/search"
          icon="i-lucide-search"
          name="搜索"
        />

        <SidebarSelector
          path="/settings"
          icon="i-lucide-settings"
          name="设置"
        />
      </div>

      <div class="pt-4 flex-1 overflow-y-auto flex flex-col justify-start h-full border-t border-t-secondary">
        <ChatsCollapse
          class="flex flex-col max-h-[85%]"
          :class="{ 'flex-1': activeChatGroup === 'user' }"
          name="用户"
          icon="i-lucide-user"
          type="user"
          :chats="chatsFiltered.filter(chat => chat.type === 'user')"
          :active="activeChatGroup === 'user'"
          @update:toggle-active="toggleActiveChatGroup('user')"
        />

        <ChatsCollapse
          class="flex flex-col max-h-[85%]"
          :class="{ 'flex-1': activeChatGroup === 'group' }"
          name="群组"
          icon="i-lucide-users"
          type="group"
          :chats="chatsFiltered.filter(chat => chat.type === 'group')"
          :active="activeChatGroup === 'group'"
          @update:toggle-active="toggleActiveChatGroup('group')"
        />

        <ChatsCollapse
          class="flex flex-col max-h-[85%]"
          :class="{ 'flex-1': activeChatGroup === 'channel' }"
          name="频道"
          icon="i-lucide-message-circle"
          type="channel"
          :chats="chatsFiltered.filter(chat => chat.type === 'channel')"
          :active="activeChatGroup === 'channel'"
          @update:toggle-active="toggleActiveChatGroup('channel')"
        />
      </div>

      <div class="flex items-center justify-between p-4">
        <div class="flex items-center gap-3">
          <div class="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full bg-muted">
            <Avatar
              :name="sessionStore.getActiveSession()?.me?.username"
              size="sm"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-sm text-foreground font-medium">{{ sessionStore.getActiveSession()?.me?.username }}</span>
            <span class="text-xs text-secondary-foreground">{{ sessionStore.getActiveSession()?.isConnected ? '已链接' : '未链接' }}</span>
          </div>
        </div>
        <div class="flex items-center">
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-foreground hover:bg-muted"
            @click="() => { isDark = !isDark }"
          />

          <Button
            icon="i-lucide-settings"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-foreground hover:bg-muted"
            @click="toggleSettingsDialog"
          />
        </div>
      </div>
    </div>

    <div class="flex flex-1 flex-col overflow-auto">
      <RouterView :key="$route.fullPath" />
    </div>

    <SettingsDialog
      v-model:show-dialog="settingsDialog"
    />
  </div>
</template>
