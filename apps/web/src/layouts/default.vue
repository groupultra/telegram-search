<script lang="ts" setup>
import type { ChatGroup } from '@tg-search/client'
import type { CoreDialog } from '@tg-search/core/types'

import buildTime from '~build/time'

import { prefillChatAvatarIntoStore, useBridgeStore, useChatStore, useSettingsStore } from '@tg-search/client'
import { breakpointsTailwind, useBreakpoints, useDark } from '@vueuse/core'
import { abbreviatedSha as gitShortSha } from '~build/git'
import { version as pkgVersion } from '~build/package'
import { storeToRefs } from 'pinia'
import { VList } from 'virtua/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterView, useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../components/avatar/EntityAvatar.vue'
import LanguageSelector from '../components/layout/LanguageSelector.vue'
import SidebarSelector from '../components/layout/SidebarSelector.vue'
import UserDropdown from '../components/layout/UserDropdown.vue'

import { Button } from '../components/ui/Button'

const settingsStore = useSettingsStore()
const { theme } = storeToRefs(settingsStore)
const isDark = useDark()

const websocketStore = useBridgeStore()
const route = useRoute()
const router = useRouter()

const { t } = useI18n()

const searchParams = ref('')

// --- Build info using unplugin-info ---
const buildVersionLabel = computed(() => {
  const version = pkgVersion ?? 'dev'
  const commit = gitShortSha
  return commit ? `${version} (${commit})` : version
})

const buildTimeLabel = computed(() => {
  const date = new Date(buildTime)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
})
// --------------------------------------

// Use VueUse breakpoints for responsive design
const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md') // < 768px

// Mobile drawer state
const mobileDrawerOpen = ref(false)

// User dropdown state
const userDropdownOpen = ref(false)

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

// Filtered chats by active group
const activeGroupChats = computed(() => {
  return chatsFiltered.value.filter(chat => chat.type === activeChatGroup.value)
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

/**
 * Prefill chat avatars from persistent cache in parallel.
 * - Avoids sequential IndexedDB waits when chat list is large.
 * - Only warms cache; network fetch continues to be driven by server events.
 */
async function prefillChatAvatarsParallel(list: CoreDialog[]) {
  const tasks = list.map(chat => prefillChatAvatarIntoStore(chat.id))
  try {
    await Promise.all(tasks)
  }
  catch (error) {
    console.warn('Failed to prefill chat avatars', error)
  }
}

/**
 * Prefill avatars for currently visible chats only.
 * - Warms disk -> memory cache for first `count` items
 * - Does NOT trigger network; visible elements use composable ensure
 */
async function prioritizeVisibleAvatars(list: CoreDialog[], count = 50) {
  const top = list.slice(0, count)
  await prefillChatAvatarsParallel(top)
}

// Prioritize visible avatars on group change and initial render
watch(activeGroupChats, (list) => {
  if (!list?.length)
    return
  void prioritizeVisibleAvatars(list)
}, { immediate: true })
</script>

<template>
  <div
    class="h-screen w-full flex overflow-hidden bg-background text-sm font-medium"
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
        size="md"
        variant="outline"
        class="h-10 w-10 rounded-lg shadow-md backdrop-blur-sm"
        @click="toggleSidebar"
      />
    </div>

    <!-- Sidebar -->
    <div
      :class="sidebarClasses.container"
      class="flex flex-col border-r bg-card h-dvh"
    >
      <!-- Search section -->
      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="border-b p-3"
      >
        <div class="relative">
          <div
            class="i-lucide-search absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2"
          />
          <input
            v-model="searchParams"
            type="text"
            class="h-9 w-full border rounded-md bg-background px-3 py-1 pl-9 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            :placeholder="t('search.search')"
          >
        </div>
      </div>

      <!-- Navigation -->
      <div class="py-2">
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
          path="/ai-chat"
          icon="i-lucide-message-square-text"
          :name="t('aiChat.aiChat')"
        />

        <SidebarSelector
          path="/settings"
          icon="i-lucide-settings"
          :name="t('settings.settings')"
        />
      </div>

      <!-- Chat groups -->
      <div
        v-if="!isMobile || mobileDrawerOpen"
        class="min-h-0 flex flex-1 flex-col border-t"
      >
        <!-- Tab selector -->
        <div class="flex items-center gap-1 border-b p-2">
          <button
            :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'user' }"
            class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="toggleActiveChatGroup('user')"
          >
            <span class="i-lucide-user h-4 w-4" />
            <span>{{ t('chatGroups.user') }}</span>
          </button>

          <button
            :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'group' }"
            class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="toggleActiveChatGroup('group')"
          >
            <span class="i-lucide-users h-4 w-4" />
            <span>{{ t('chatGroups.group') }}</span>
          </button>

          <button
            :class="{ 'bg-accent text-accent-foreground': activeChatGroup === 'channel' }"
            class="flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            @click="toggleActiveChatGroup('channel')"
          >
            <span class="i-lucide-message-circle h-4 w-4" />
            <span>{{ t('chatGroups.channel') }}</span>
          </button>
        </div>

        <!-- Chat list -->
        <div class="min-h-0 flex-1 overflow-hidden">
          <VList
            :data="activeGroupChats"
            class="h-full py-2"
          >
            <template #default="{ item: chat }">
              <div
                :key="chat.id"
                :class="{ 'bg-accent text-accent-foreground': route.params.chatId === chat.id.toString() }"
                class="mx-2 my-0.5 flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 transition-colors hover:bg-accent hover:text-accent-foreground"
                @click="router.push(`/chat/${chat.id}`)"
              >
                <EntityAvatar
                  :id="chat.id"
                  entity="other"
                  entity-type="chat"
                  :file-id="chat.avatarFileId"
                  :name="chat.name"
                  size="sm"
                />
                <div class="min-w-0 flex flex-1 flex-col">
                  <span class="truncate text-sm font-medium">
                    {{ chat.name }}
                  </span>
                  <span class="truncate text-xs text-muted-foreground">
                    {{ chat.id }}
                  </span>
                </div>
              </div>
            </template>
          </VList>
        </div>
      </div>

      <!-- User profile section -->
      <div class="relative border-t p-3">
        <div class="flex items-center justify-between gap-2">
          <div
            class="min-w-0 flex flex-1 cursor-pointer items-center gap-2.5 rounded-md p-1 transition-colors hover:bg-accent"
            @click="userDropdownOpen = !userDropdownOpen"
          >
            <div class="h-8 w-8 flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
              <EntityAvatar
                v-if="websocketStore.getActiveSession()?.me?.id != null"
                :id="websocketStore.getActiveSession()?.me?.id!"
                entity="self"
                entity-type="user"
                :name="websocketStore.getActiveSession()?.me?.name"
                size="sm"
              />
            </div>
            <div class="min-w-0 flex flex-1 flex-col">
              <span class="truncate text-sm font-medium">{{ websocketStore.getActiveSession()?.me?.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ websocketStore.getActiveSession()?.isConnected ? t('settings.connected') : t('settings.disconnected') }}</span>
            </div>
            <div class="i-lucide-chevron-up h-4 w-4 flex-shrink-0 text-muted-foreground" />
          </div>

          <!-- Control buttons -->
          <div class="flex flex-shrink-0 items-center gap-1">
            <Button
              :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
              class="h-8 w-8 rounded-md p-0"
              variant="ghost"
              size="sm"
              :title="isDark ? t('settings.switchToLightMode') : t('settings.switchToDarkMode')"
              @click="() => { isDark = !isDark }"
            />

            <LanguageSelector />
          </div>
        </div>

        <!-- User dropdown menu -->
        <UserDropdown v-model:open="userDropdownOpen" />
      </div>
    </div>

    <!-- Main content -->
    <div
      class="relative flex flex-1 flex-col overflow-auto bg-background"
      :class="{ 'ml-0': isMobile }"
    >
      <RouterView :key="$route.fullPath" />

      <!-- Version info -->
      <div class="pointer-events-none fixed bottom-3 right-3 z-10 flex items-center gap-2 text-xs text-muted-foreground opacity-50">
        <span class="truncate">{{ buildVersionLabel }}</span>
        <span
          v-if="buildTimeLabel"
          class="truncate"
        >{{ buildTimeLabel }}</span>
      </div>
    </div>
  </div>
</template>
