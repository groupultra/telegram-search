<script lang="ts" setup>
import type { ChatGroup } from '@tg-search/client'

import { useAuthStore, useChatStore, useSettingsStore, useWebsocketStore } from '@tg-search/client'
import { useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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

// Responsive sidebar state
const isMobile = ref(false)
const isTablet = ref(false)
const sidebarCollapsed = ref(false)
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

// Responsive breakpoints
function updateScreenSize() {
  const width = window.innerWidth
  isMobile.value = width < 768
  isTablet.value = width >= 768 && width < 1024

  // Auto-collapse sidebar on tablet
  if (isTablet.value && !sidebarCollapsed.value) {
    sidebarCollapsed.value = true
  }
  else if (!isMobile.value && !isTablet.value) {
    sidebarCollapsed.value = false
  }
}

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
  else if (isTablet.value) {
    return {
      container: `w-16 ${sidebarCollapsed.value ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out`,
      backdrop: false,
    }
  }
  else {
    return {
      container: `${sidebarCollapsed.value ? 'w-16' : 'w-80'} transition-all duration-300 ease-in-out`,
      backdrop: false,
    }
  }
})

// Show/hide sidebar content based on collapse state
const showSidebarContent = computed(() => {
  return !sidebarCollapsed.value || isMobile.value
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

onMounted(() => {
  updateScreenSize()
  window.addEventListener('resize', updateScreenSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScreenSize)
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
  else {
    sidebarCollapsed.value = !sidebarCollapsed.value
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
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
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
        class="h-10 w-10 flex touch-manipulation items-center justify-center border rounded-lg bg-background shadow-lg"
        @click="toggleSidebar"
      />
    </div>

    <!-- Login prompt banner -->
    <div
      v-if="!isLoggedIn"
      class="fixed left-0 right-0 top-0 z-50 bg-yellow-500 px-4 py-2 text-center text-sm text-yellow-900 font-medium transition-all duration-300 ease-in-out"
      :class="{ 'left-16': !isMobile && sidebarCollapsed, 'left-80': !isMobile && !sidebarCollapsed }"
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
      class="flex flex-col border-r border-r-secondary bg-background h-dvh"
    >
      <!-- Desktop collapse toggle -->
      <div
        v-if="!isMobile"
        class="absolute top-6 z-10 -right-3"
      >
        <Button
          :icon="sidebarCollapsed ? 'i-lucide-chevron-right' : 'i-lucide-chevron-left'"
          class="h-6 w-6 flex items-center justify-center border rounded-full bg-background text-xs shadow-md transition-shadow hover:shadow-lg"
          @click="toggleSidebar"
        />
      </div>

      <!-- Search section -->
      <div
        v-if="showSidebarContent"
        class="relative p-4"
      >
        <div
          class="i-lucide-search absolute left-7 top-1/2 h-4 w-4 text-complementary-500 -translate-y-1/2"
        />
        <input
          v-model="searchParams"
          type="text"
          class="w-full border border-neutral-200 rounded-md bg-neutral-100 px-3 py-2 pl-9 ring-offset-background transition-all dark:border-neutral-700 dark:bg-neutral-800 placeholder:text-complementary-500 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Search"
        >
      </div>

      <!-- Collapsed search icon -->
      <div
        v-if="!showSidebarContent"
        class="flex justify-center p-4"
      >
        <div class="i-lucide-search h-5 w-5 cursor-pointer text-complementary-500 transition-colors hover:text-primary" />
      </div>

      <!-- Navigation -->
      <div class="mb-4">
        <SidebarSelector
          path="/"
          icon="i-lucide-home"
          :name="showSidebarContent ? '主页' : ''"
          :tooltip="!showSidebarContent ? '主页' : ''"
        />

        <SidebarSelector
          path="/sync"
          icon="i-lucide-refresh-cw"
          :name="showSidebarContent ? '同步' : ''"
          :tooltip="!showSidebarContent ? '同步' : ''"
        />

        <SidebarSelector
          path="/search"
          icon="i-lucide-search"
          :name="showSidebarContent ? '搜索' : ''"
          :tooltip="!showSidebarContent ? '搜索' : ''"
        />

        <SidebarSelector
          path="/settings"
          icon="i-lucide-settings"
          :name="showSidebarContent ? '设置' : ''"
          :tooltip="!showSidebarContent ? '设置' : ''"
        />
      </div>

      <!-- Chat groups -->
      <div
        v-if="showSidebarContent"
        class="h-full flex flex-1 flex-col justify-start overflow-y-auto border-t border-t-secondary pt-4"
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

      <!-- Collapsed chat icons -->
      <div
        v-if="!showSidebarContent"
        class="flex flex-1 flex-col items-center justify-center gap-4 border-t border-t-secondary pt-4"
      >
        <div
          class="i-lucide-user h-5 w-5 cursor-pointer rounded-md p-2 text-complementary-500 transition-colors hover:bg-neutral-100 hover:text-primary"
          title="用户"
          @click="toggleActiveChatGroup('user')"
        />
        <div
          class="i-lucide-users h-5 w-5 cursor-pointer rounded-md p-2 text-complementary-500 transition-colors hover:bg-neutral-100 hover:text-primary"
          title="群组"
          @click="toggleActiveChatGroup('group')"
        />
        <div
          class="i-lucide-message-circle h-5 w-5 cursor-pointer rounded-md p-2 text-complementary-500 transition-colors hover:bg-neutral-100 hover:text-primary"
          title="频道"
          @click="toggleActiveChatGroup('channel')"
        />
      </div>

      <!-- User profile section -->
      <div class="flex items-center justify-between border-t border-t-secondary p-4">
        <div
          v-if="showSidebarContent"
          class="mr-3 flex items-center gap-3"
        >
          <div class="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-2 ring-offset-1 ring-primary/10">
            <Avatar
              :name="websocketStore.getActiveSession()?.me?.username"
              size="sm"
            />
          </div>
          <div class="flex flex-col">
            <span class="whitespace-nowrap text-sm text-primary-900 font-medium">{{ websocketStore.getActiveSession()?.me?.username }}</span>
            <span class="whitespace-nowrap text-xs text-complementary-600">{{ websocketStore.getActiveSession()?.isConnected ? '已链接' : '未链接' }}</span>
          </div>
        </div>

        <!-- Collapsed user avatar -->
        <div
          v-if="!showSidebarContent"
          class="w-full flex justify-center"
        >
          <div class="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full bg-neutral-100 ring-2 ring-offset-1 ring-primary/10">
            <Avatar
              :name="websocketStore.getActiveSession()?.me?.username"
              size="sm"
            />
          </div>
        </div>

        <!-- Control buttons -->
        <div
          class="flex items-center"
          :class="{ 'flex-col gap-2': !showSidebarContent }"
        >
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-primary-900 transition-colors hover:bg-neutral-100"
            :title="isDark ? '切换到亮色模式' : '切换到暗色模式'"
            @click="() => { isDark = !isDark }"
          />

          <Button
            icon="i-lucide-settings"
            class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-primary-900 transition-colors hover:bg-neutral-100"
            title="设置"
            @click="toggleSettingsDialog"
          />
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div
      class="flex flex-1 flex-col overflow-auto transition-all duration-300 ease-in-out"
      :class="{ 'ml-0': isMobile }"
    >
      <RouterView :key="$route.fullPath" />
    </div>

    <SettingsDialog
      v-model:show-dialog="settingsDialog"
    />
  </div>
</template>
