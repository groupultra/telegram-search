<script lang="ts" setup>
import type { ChatGroup } from '@tg-search/client'

import { useAuthStore, useBridgeStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { breakpointsTailwind, useBreakpoints, useDark } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import SettingsDialog from '../components/layout/SettingsDialog.vue'
import SidebarSelector from '../components/layout/SidebarSelector.vue'
import SettingsMenu from '../components/SettingsMenu.vue'
import Avatar from '../components/ui/Avatar.vue'
import { Button } from '../components/ui/Button'

const settingsStore = useSettingsStore()
const { theme } = storeToRefs(settingsStore)
const isDark = useDark()

const websocketStore = useBridgeStore()
const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)

const router = useRouter()
const route = useRoute()

const { t, locale } = useI18n()

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

type NamedChatGroup = Exclude<ChatGroup, ''>

interface ChatGroupTab {
  key: NamedChatGroup
  label: string
  icon: string
  count: number
}

const chatGroupOrder: NamedChatGroup[] = ['user', 'group', 'channel']

const chatTabs = computed<ChatGroupTab[]>(() => {
  const counts = chatsFiltered.value.reduce<Record<NamedChatGroup, number>>((acc, chat) => {
    acc[chat.type] += 1
    return acc
  }, {
    user: 0,
    group: 0,
    channel: 0,
  })

  const icons: Record<NamedChatGroup, string> = {
    user: 'i-lucide-user',
    group: 'i-lucide-users',
    channel: 'i-lucide-message-circle',
  }

  return chatGroupOrder.map((key) => {
    return {
      key,
      label: t(`chatGroups.${key}`),
      icon: icons[key],
      count: counts[key],
    }
  })
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

const visibleChats = computed(() => {
  const group = activeChatGroup.value
  if (!group) {
    return chatsFiltered.value
  }

  return chatsFiltered.value.filter(chat => chat.type === group)
})

const timeFormatter = computed(() => new Intl.DateTimeFormat(locale.value, {
  hour: '2-digit',
  minute: '2-digit',
}))

function formatChatTimestamp(date?: Date) {
  if (!date)
    return ''

  return timeFormatter.value.format(date)
}

const compactNumberFormatter = computed(() => new Intl.NumberFormat(locale.value, {
  notation: 'compact',
  maximumFractionDigits: 1,
}))

function formatUnreadCount(count?: number) {
  if (!count)
    return ''

  return compactNumberFormatter.value.format(count)
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

function isActiveChat(chatId: string) {
  return route.params.chatId === chatId
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
    class="flex h-screen w-full overflow-hidden bg-background text-sm font-medium text-foreground"
  >
    <!-- Mobile backdrop -->
    <div
      v-if="sidebarClasses.backdrop"
      class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity"
      @click="closeMobileDrawer"
    />

    <!-- Mobile menu button -->
    <div
      v-if="isMobile"
      class="fixed left-4 top-4 z-50"
    >
      <Button
        icon="i-lucide-menu"
        class="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-card-foreground shadow-md backdrop-blur-sm transition-all hover:bg-muted hover:shadow-lg touch-manipulation"
        @click="toggleSidebar"
      />
    </div>

    <!-- Sidebar -->
    <div
      :class="sidebarClasses.container"
      class="flex h-dvh flex-col border-r border-border bg-card text-card-foreground shadow-[0_10px_40px_-24px_rgba(15,23,42,0.18)] dark:shadow-[0_10px_40px_-24px_rgba(15,15,15,0.45)]"
    >
      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="flex flex-col gap-5 px-4 pb-5 pt-6"
      >
        <div class="flex items-center gap-3">
          <SettingsMenu />
          <div
            class="i-lucide-menu hidden h-5 w-5 text-muted-foreground md:block"
          />
          <div class="relative flex-1">
            <div
              class="i-lucide-search pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              v-model="searchParams"
              type="text"
              class="w-full rounded-full bg-muted px-4 py-3 pl-12 text-sm text-foreground shadow-inner transition placeholder:text-muted-foreground focus:(outline-none ring-2 ring-primary)"
              :placeholder="t('search.search')"
            >
          </div>
          <div class="hidden h-10 w-10 items-center justify-center rounded-full bg-muted shadow-inner md:flex">
            <Avatar
              :name="websocketStore.getActiveSession()?.me?.name"
              size="sm"
            />
          </div>
        </div>

        <div class="flex gap-2 overflow-x-auto" role="tablist">
          <button
            v-for="tab in chatTabs"
            :key="tab.key"
            type="button"
            :aria-pressed="activeChatGroup === tab.key"
            class="flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition"
            :class="activeChatGroup === tab.key
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-card'
            "
            @click="toggleActiveChatGroup(tab.key)"
          >
            <span :class="tab.icon" class="h-4 w-4" />
            <span class="whitespace-nowrap">{{ tab.label }}</span>
            <span
              v-if="tab.count"
              class="flex h-5 min-w-[1.75rem] items-center justify-center rounded-full bg-primary/20 px-2 text-[11px] text-primary"
            >
              {{ tab.count }}
            </span>
          </button>
        </div>

        <div class="flex flex-col gap-2 rounded-3xl bg-muted/80 p-3 shadow-inner">
          <SidebarSelector
            path="/sync"
            icon="i-lucide-refresh-cw"
            :name="t('sync.sync')"
          />
          <SidebarSelector
            path="/search"
            icon="i-lucide-search"
            :name="t('search.search')"
          />
          <SidebarSelector
            path="/settings"
            icon="i-lucide-settings"
            :name="t('settings.settings')"
          />
        </div>
      </div>

      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="flex-1 overflow-y-auto px-3 pb-4"
      >
        <div
          v-for="chat in visibleChats"
          :key="chat.id"
          class="group flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 transition-all duration-200"
          :class="isActiveChat(chat.id.toString())
            ? 'bg-muted'
            : 'hover:bg-muted'
          "
          @click="router.push(`/chat/${chat.id}`)"
        >
          <Avatar
            :name="chat.name"
            size="md"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="flex-1 truncate text-sm font-semibold text-foreground">{{ chat.name }}</span>
              <span
                v-if="formatChatTimestamp(chat.lastMessageDate)"
                class="text-xs text-muted-foreground"
              >
                {{ formatChatTimestamp(chat.lastMessageDate) }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <span class="flex-1 truncate text-xs text-muted-foreground">
                {{ chat.lastMessage ?? t('sidebar.noRecentMessages') }}
              </span>
              <span
                v-if="chat.unreadCount"
                class="flex h-6 min-w-[2.25rem] items-center justify-center rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
              >
                {{ formatUnreadCount(chat.unreadCount) }}
              </span>
            </div>
          </div>
        </div>
        <div
          v-if="!visibleChats.length"
          class="mt-10 text-center text-xs text-muted-foreground"
        >
          {{ t('sidebar.noResults') }}
        </div>
      </div>

      <!-- User profile section -->
      <div class="flex items-center justify-between gap-3 border-t border-border px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
            <Avatar
              :name="websocketStore.getActiveSession()?.me?.name"
              size="sm"
            />
          </div>
          <div class="min-w-0 flex flex-col">
            <span class="truncate text-sm font-semibold text-foreground">{{ websocketStore.getActiveSession()?.me?.name }}</span>
            <span class="text-xs text-muted-foreground">{{ websocketStore.getActiveSession()?.isConnected ? t('settings.connected') : t('settings.disconnected') }}</span>
          </div>
        </div>

        <!-- Control buttons -->
        <div class="flex items-center gap-2">
          <Button
            :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-card"
            :title="isDark ? t('settings.switchToLightMode') : t('settings.switchToDarkMode')"
            @click="() => { isDark = !isDark }"
          />

          <Button
            icon="i-lucide-settings"
            class="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-card"
            :title="t('settings.settings')"
            @click="toggleSettingsDialog"
          />
        </div>
      </div>
    </div>

    <!-- Main content -->
    <div
      class="flex flex-1 flex-col overflow-auto bg-background transition-all duration-300 ease-in-out"
      :class="{ 'ml-0': isMobile }"
    >
      <!-- Login prompt banner -->
      <div
        v-if="!isLoggedIn"
        class="bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-all duration-300 ease-in-out"
        :class="{ 'left-80': !isMobile }"
      >
        <div class="flex items-center justify-center gap-2 text-primary-foreground">
          <div class="i-lucide-alert-triangle" />
          <span>{{ t('loginPromptBanner.pleaseLoginToUseFullFeatures') }}</span>
          <Button
            size="sm"
            icon="i-lucide-user"
            class="ml-2 border border-white/20 bg-white/20 text-white transition-colors hover:bg-white/30"
            @click="router.push('/login')"
          >
            {{ t('loginPromptBanner.login') }}
          </Button>
        </div>
      </div>

      <RouterView :key="$route.fullPath" />
    </div>

    <SettingsDialog
      v-model:show-dialog="settingsDialog"
    />
  </div>
</template>
