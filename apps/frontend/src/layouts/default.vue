<script lang="ts" setup>
import type { CoreDialog } from '@tg-search/core'
import type { Action } from '../types/action'
import type { Page } from '../types/page'
import { useDark } from '@vueuse/core'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../store/useChat'
import { useSessionStore } from '../store/useSession'

const sessionStore = useSessionStore()

const { getWsContext } = sessionStore
const wsContext = getWsContext()

const settingsDialog = ref(false)

const headerState = reactive<{
  title: string
  actions: Action[]
  hidden: boolean
  collapsed: boolean
}>({
  title: '',
  actions: [
  ],
  hidden: false,
  collapsed: false,
})

const pages = ref<Page[]>([
  {
    name: '主页',
    icon: 'i-lucide-home',
    path: '/',
  },
  {
    name: '嵌入',
    icon: 'i-lucide-folder-open',
    path: '/embed',
  },
  {
    name: '同步',
    icon: 'i-lucide-folder-sync',
    path: '/sync',
  },
  {
    name: '配置',
    icon: 'i-lucide-settings',
    path: '/settings',
  },
])
const currentPage = ref<Page | undefined>()
const selectedChatId = ref<number | null>(null)

const chatTypes = ref([
  {
    name: '私聊',
    icon: 'i-lucide-user',
    type: 'user',
  },
  {
    name: '群聊',
    icon: 'i-lucide-users',
    type: 'group',
  },
  {
    name: '频道',
    icon: 'i-lucide-hash',
    type: 'channel',
  },
])

const search = ref('')

const chatStore = useChatStore()

const chats = computed(() => chatStore.chats)
const chatsFiltered = computed(() => {
  return chats.value.filter(chat => chat.name.toLowerCase().includes(search.value.toLowerCase()))
})

const router = useRouter()

const showActions = ref(false)

const isDark = useDark()

const currentTheme = ref('default')

function setTheme(theme: string) {
  currentTheme.value = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

// 初始化主题
onMounted(() => {
  if (!sessionStore.getActiveSession()?.isConnected && router.currentRoute.value.path !== '/login') {
    router.push('/login')
  }
  wsContext.sendEvent('entity:me:fetch', undefined)
  wsContext.sendEvent('dialog:fetch', undefined)
  const savedTheme = localStorage.getItem('theme') || 'default'
  setTheme(savedTheme)
})

// 监听主题变化
watch(currentTheme, (newTheme) => {
  localStorage.setItem('theme', newTheme)
})

function changeTitle(newTitle: string) {
  headerState.title = newTitle
}

function setHidden(hidden: boolean) {
  headerState.hidden = hidden
}

function setActions(actions: Action[]) {
  // @ts-expect-error: headerState.actions is readonly but we need to modify it
  headerState.actions = actions
}

function setCollapsed(collapsed: boolean) {
  headerState.collapsed = collapsed
}

function clearSelectedChatAndPage() {
  selectedChatId.value = null
  currentPage.value = undefined
}

function handleClick(chat: CoreDialog) {
  router.push(`/chat/${chat.id}?type=${chat.type}`)
  clearSelectedChatAndPage()
  setActions([])
  selectedChatId.value = chat.id
}

function handlePageClick(page: Page) {
  clearSelectedChatAndPage()
  setActions([])
  currentPage.value = page
  changeTitle(page.name)
  router.push(page.path)
}

function toggleSettingsDialog() {
  settingsDialog.value = !settingsDialog.value
}

function toggleActions() {
  showActions.value = !showActions.value
}
</script>

<template>
  <div class="h-screen w-full flex overflow-hidden bg-background" :class="{ dark: isDark }">
    <Dialog v-model="settingsDialog">
      <Settings
        @toggle-settings-dialog-emit="toggleSettingsDialog"
        @set-theme-emit="setTheme"
      />
    </Dialog>
    <div class="z-40 h-full w-64 border-r border-r-secondary bg-background dark:border-r-secondary">
      <div class="h-full flex flex-col overflow-hidden">
        <div class="p-2">
          <div class="relative">
            <div
              class="i-lucide-search absolute left-2 top-1/2 h-4 w-4 text-xl text-secondary-foreground -translate-y-1/2 dark:text-secondary-foreground"
            />
            <input
              v-model="search" type="text"
              class="border-input w-full border border-secondary rounded-md bg-muted px-3 py-2 pl-9 text-sm text-foreground ring-offset-background dark:border-secondary dark:bg-muted"
              placeholder="Search"
            >
          </div>
        </div>
        <!-- Main menu -->
        <div class="mt-2 p-2">
          <ul class="space-y-1">
            <li
              v-for="page in pages" :key="page.path"
              :class="{ 'bg-muted dark:bg-muted': currentPage?.path === page.path }"
              class="transition-colors hover:bg-muted dark:hover:bg-muted"
              @click="handlePageClick(page)"
            >
              <IconButton class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground" :icon="page.icon">
                <span>{{ page.name }}</span>
              </IconButton>
            </li>
          </ul>
        </div>

        <!-- Chats -->
        <div v-for="chatType in chatTypes" :key="chatType.type" class="mt-4">
          <ChatGroup
            :title="chatType.name" :chats="chatsFiltered.filter(chat => chat.type === chatType.type)"
            :icon="chatType.icon" :type="chatType.type" :selected-chat-id="selectedChatId" @click="handleClick"
          />
        </div>
        <!-- User profile -->
        <div class="mt-auto border-t border-t-secondary p-4 dark:border-t-secondary">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="h-8 w-8 flex items-center justify-center overflow-hidden rounded-full bg-muted">
                <img
                  alt="Me" src="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird"
                  class="h-full w-full object-cover"
                >
              </div>
              <div class="flex flex-col">
                <span class="text-sm text-foreground font-medium">{{ sessionStore.getActiveSession()?.me?.username }}</span>
                <span class="text-xs text-secondary-foreground">{{ sessionStore.getActiveSession()?.isConnected ? '已链接' : '未链接' }}</span>
              </div>
            </div>
            <div class="flex items-center">
              <button
                class="h-8 w-8 flex items-center justify-center rounded-md p-1 text-foreground hover:bg-muted"
                @click="toggleSettingsDialog"
              >
                <div class="i-lucide-settings h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-1 flex-col overflow-hidden">
      <header v-show="!headerState.hidden" class="h-14 flex items-center border-b border-b-secondary px-4 dark:border-b-secondary">
        <div class="flex items-center gap-2">
          <span class="text-foreground font-medium">{{ headerState.title }}</span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <TransitionGroup name="action">
            <template v-if="showActions || headerState.collapsed">
              <button
                v-for="(action, index) in headerState.actions" :key="index"
                class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-foreground transition-colors hover:bg-muted"
                :class="{ 'opacity-50': action.disabled, 'cursor-not-allowed': action.disabled }"
                :disabled="action.disabled"
                @click="action.onClick"
              >
                <div :class="action.icon" class="h-5 w-5" />
                <span v-if="action.name" class="text-sm">{{ action.name }}</span>
              </button>
            </template>
          </TransitionGroup>
          <button v-if="!headerState.collapsed" class="rounded-md p-2 text-foreground transition-colors hover:bg-muted" @click="toggleActions">
            <div
              class="i-lucide-ellipsis h-5 w-5 transition-transform duration-300"
              :class="{ 'rotate-90': showActions }"
            />
          </button>
        </div>
      </header>
      <main class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-auto p-4">
          <slot v-bind="{ changeTitle, setActions, setHidden, setCollapsed }" />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.action-enter-active,
.action-leave-active {
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}

.action-enter-from,
.action-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.action-enter-to,
.action-leave-from {
  opacity: 1;
  transform: translateX(0);
}

.action-move {
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
