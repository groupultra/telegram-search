<script lang="ts" setup>
import type { ChatGroup } from '@tg-search/client'

import { useAuthStore, useChatStore, useSettingsStore, useWebsocketStore } from '@tg-search/client'
import { breakpointsTailwind, useBreakpoints, useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import ChatsCollapse from '../components/layout/ChatsCollapse.vue'
import SettingsDialog from '../components/layout/SettingsDialog.vue'
import SidebarSelector from '../components/layout/SidebarSelector.vue'
import Avatar from '../components/ui/Avatar.vue'
import { Button } from '../components/ui/Button'

const settingsStore = useSettingsStore()
const { theme } = storeToRefs(settingsStore)
const isDark = useDark()

const websocketStore = useWebsocketStore()
const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)

const router = useRouter()
const route = useRoute()

const settingsDialog = ref(false)
const searchParams = ref('')

// Use VueUse breakpoints for responsive design
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md') // < 768px

// Mobile drawer state
const mobileDrawerOpen = ref(false)

const chatStore = useChatStore()
const chats = computed(() => chatStore.chats)
const chatsFiltered = computed(() => {
  return chats.value.filter(chat => chat.name.toLowerCase().includes(searchParams.value.toLowerCase()))
})

const { selectedGroup } = storeToRefs(useSettingsStore())
const activeChatGroup = computed(() => {
  if (route.params.chatId) {
    const currentChat = chatStore.getChat(route.params.chatId.toString())
    if (currentChat) {
      return currentChat.type
    }
  }
  return selectedGroup.value
})

// Computed classes for responsive design
const sidebarClasses = computed(() => {
  if (isMobile.value) {
    return {
      container: `fixed inset-y-0 left-0 z-40 w-80 transform transition-transform duration-300 ease-in-out ${
        mobileDrawerOpen.value ? 'translate-x-0' : '-translate-x-full'
      }`,
      backdrop: mobileDrawerOpen.value,
    }
  }
  else {
    return {
      container: 'w-80',
      backdrop: false,
    }
  }
})

watch(theme, (newTheme) => {
  document.documentElement.setAttribute('data-theme', newTheme)
}, { immediate: true })

// Close mobile drawer when route changes
watch(route, () => {
  if (isMobile.value) {
    mobileDrawerOpen.value = false
  }
})

function toggleSettingsDialog() {
  settingsDialog.value = !settingsDialog.value
}

function toggleActiveChatGroup(group: ChatGroup) {
  selectedGroup.value = group
}

function toggleSidebar() {
  if (isMobile.value) {
    mobileDrawerOpen.value = !mobileDrawerOpen.value
  }
}

function closeMobileDrawer() {
  if (isMobile.value) {
    mobileDrawerOpen.value = false
  }
}
</script>

<template>
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium dark:bg-gray-900"
  >
    <!-- Mobile backdrop -->
    <div
      v-if="sidebarClasses.backdrop"
      class="fixed inset-0 z-30 bg-black bg-opacity-50 transition-opacity"
      @click="closeMobileDrawer"
    />

    <!-- Mobile menu button -->
    <div
      v-if="isMobile"
      class="fixed left-4 top-4 z-50"
    >
      <Button
        icon="i-lucide-menu"
        class="h-10 w-10 flex touch-manipulation items-center justify-center border border-neutral-300 rounded-lg bg-white/90 text-gray-600 shadow-md backdrop-blur-sm transition-all dark:border-gray-600 dark:bg-gray-800/90 hover:bg-white dark:text-gray-400 hover:text-gray-700 hover:shadow-lg dark:hover:bg-gray-700 dark:hover:text-gray-200"
        @click="toggleSidebar"
      />
    </div>

    <!-- Login prompt banner -->
    <div
      v-if="!isLoggedIn"
      class="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-sm text-yellow-900 font-medium transition-all duration-300 ease-in-out"
      :class="{ 'left-80': !isMobile }"
    >
      <div class="flex items-center justify-center gap-2">
        <div class="i-lucide-alert-triangle" />
        <span>请先登录 Telegram 账号以使用完整功能</span>
        <Button
          size="sm"
          icon="i-lucide-user"
          class="ml-2 border border-yellow-700 bg-yellow-600 text-yellow-100 hover:bg-yellow-700"
          @click="router.push('/login')"
        >
          去登录
        </Button>
      </div>
    </div>

    <!-- Sidebar -->
    <div
      :class="sidebarClasses.container"
      class="flex flex-col border-r border-r-secondary bg-background h-dvh dark:border-r-gray-700 dark:bg-gray-800"
    >
      <!-- Search section -->
      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="p-4"
      >
        <div class="relative">
          <div
            class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-gray-500 -translate-y-1/2 dark:text-gray-400"
          />
          <input
            v-model="searchParams"
            type="text"
            class="w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 pl-9 ring-offset-background transition-all dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary dark:ring-offset-gray-800 dark:placeholder:text-gray-400"
            placeholder="Search"
          >
        </div>
      </div>

      <!-- Navigation -->
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

      <!-- Chat groups -->
      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="h-full flex flex-1 flex-col justify-start overflow-y-auto border-t border-t-secondary pt-4 dark:border-t-gray-700"
      >
        <ChatsCollapse
          class="max-h-[85%] flex flex-col"
          :class="{ 'flex-1': activeChatGroup === 'user' }"
          name="用户"
          icon="i-lucide-user"
          type="user"
          :chats="chatsFiltered.filter(chat => chat.type === 'user')"
          :active="activeChatGroup === 'user'"
          @update:toggle-active="toggleActiveChatGroup('user')"
        />

        <ChatsCollapse
          class="max-h-[85%] flex flex-col"
          :class="{ 'flex-1': activeChatGroup === 'group' }"
          name="群组"
          icon="i-lucide-users"
          type="group"
          :chats="chatsFiltered.filter(chat => chat.type === 'group')"
          :active="activeChatGroup === 'group'"
          @update:toggle-active="toggleActiveChatGroup('group')"
        />

        <ChatsCollapse
          class="max-h-[85%] flex flex-col"
          :class="{ 'flex-1': activeChatGroup === 'channel' }"
          name="频道"
          icon="i-lucide-message-circle"
          type="channel"
          :chats="chatsFiltered.filter(chat => chat.type === 'channel')"
          :active="activeChatGroup === 'channel'"
          @update:toggle-active="toggleActiveChatGroup('channel')"
        />
      </div>

      <!-- User profile section -->
      <div class="flex items-center justify-between border-t border-t-secondary p-4 dark:border-t-gray-700">
        <div class="mr-3 flex items-center gap-3">
          <div class="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-2 ring-offset-1 ring-primary/10 dark:bg-gray-700">
            <Avatar
              :name="websocketStore.getActiveSession()?.me?.username"
              size="sm"
            />
          </div>
          <div class="flex flex-col">
            <span class="whitespace-nowrap text-sm text-gray-900 font-medium dark:text-gray-100">{{ websocketStore.getActiveSession()?.me?.username }}</span>
            <span class="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">{{ websocketStore.getActiveSession()?.isConnected ? '已链接' : '未链接' }}</span>
          </div>
        </div>

        <!-- Control buttons -->
        <div class="flex items-center gap-2">
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-gray-900 transition-colors hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
            :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
            @click="() => { isDark = !isDark }"
          />

          <Button
            icon="i-lucide-settings"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-gray-900 transition-colors hover:bg-neutral-100 dark:text-gray-100 dark:hover:bg-gray-700"
            title="设置"
            @click="toggleSettingsDialog"
          />
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div
      class="flex flex-1 flex-col overflow-auto bg-background transition-all duration-300 ease-in-out dark:bg-gray-900"
      :class="{ 'ml-0': isMobile }"
    >
      <RouterView :key="$route.fullPath" />
    </div>

    <SettingsDialog
      v-model:show-dialog="settingsDialog"
    />
  </div>
</template>
