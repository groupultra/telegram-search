<script lang="ts" setup>
import type { CoreDialog } from '@tg-search/core'
import type { Action } from '../types/action'
import { useDark, useToggle } from '@vueuse/core'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../store/useSessionV2'
import { Chat } from '../types/chat'
import { Page } from '../types/page'
import { title } from 'process'

const sessionStore = useSessionStore()

const { getWsContext } = sessionStore
// const wsContext = getWsContext()

const settingsDialog = ref(false)

const headerState = reactive<{
  title: string
  actions: Action[]
  hidden: boolean
}>({
  title: '',
  actions: [
  ],
  hidden: false,
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
])
const currentPage = ref<Page | undefined>()

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

const chats = ref<Chat[]>([])
const chatsFiltered = computed(() => {
  return chats.value.filter(chat => chat.name.includes(search.value))
})

const router = useRouter()

const showActions = ref(false)

onMounted(() => {
  chats.value = [
    {
      id: 1,
      name: '用户122',
      type: 'user',
    },
    {
      id: 2,
      name: '群聊1',
      type: 'group',
    },
    {
      id: 3,
      name: '频道1',
      type: 'channel',
    },
    {
      id: 4,
      name: '频道2',
      type: 'channel',
    },
  ]
  // wsContext.sendEvent('dialog:fetch')
  // wsContext.on('dialog:fetch', (data) => {
  //   console.log(data)
  // })
})

function changeTitle(newTitle: string) {
  headerState.title = newTitle
}

function setHidden(hidden: boolean) {
  headerState.hidden = hidden
}

function setActions(actions: Action[]) {
  headerState.actions = actions
}

function clearSelectedChatAndPage() {
  chats.value.forEach(c => {
    c.isSelected = false
  })
  currentPage.value = undefined
}

function handleClick(chat: CoreDialog) {
  router.push(`/chat/${chat.id}?type=${chat.type}`)
  clearSelectedChatAndPage()
  setActions([])
  chats.value.forEach(c => {
    c.isSelected = c.id === chat.id
  })

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

const isDark = useDark()
const toggleDark = useToggle(isDark)
</script>

<template>
  <div class="bg-background h-screen w-full flex overflow-hidden" :class="{ dark: isDark }">
    <Dialog v-model="settingsDialog">
      <Settings @toggleSettingsDialog="toggleSettingsDialog" />
    </Dialog>
    <div class="bg-background z-40 h-full w-64 border-r border-r-gray-200 dark:border-r-gray-800">
      <div class="h-full flex flex-col overflow-hidden">
        <div class="p-2">
          <div class="relative">
            <div
              class="i-lucide-search text-gray-500 dark:text-gray-400 absolute left-2 top-1/2 h-4 w-4 text-xl -translate-y-1/2" />
            <input v-model="search" type="text"
              class="border-input bg-gray-50 dark:bg-gray-900 ring-offset-background w-full border border-gray-200 dark:border-gray-800 rounded-md px-3 py-2 pl-9 text-sm"
              placeholder="Search">
          </div>
        </div>
        <!-- Main menu -->
        <div class="mt-2 p-2">
          <ul class="space-y-1">
            <li v-for="page in pages" :key="page.path" :class="{ 'bg-gray-50 dark:bg-gray-800': currentPage?.path === page.path }"
              @click="handlePageClick(page)">
              <IconButton class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm" :icon="page.icon">
                <span>{{ page.name }}</span>
              </IconButton>
            </li>
          </ul>
        </div>


        <!-- Chats -->
        <div class="mt-4" v-for="chatType in chatTypes" :key="chatType.type">
          <ChatGroup :title="chatType.name" :chats="chatsFiltered.filter(chat => chat.type === chatType.type)"
            :icon="chatType.icon" :type="chatType.type" @click="handleClick" />
        </div>
        <!-- User profile -->
        <div class="mt-auto border-t border-t-gray-200 dark:border-t-gray-800 p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="bg-muted h-8 w-8 flex items-center justify-center overflow-hidden rounded-full">
                <img alt="Me" src="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird"
                  class="h-full w-full object-cover">
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-medium">我的用户名</span>
                <span class="text-muted-foreground text-xs">已链接</span>
              </div>
            </div>
            <div class="flex items-center">
              <button class="hover:bg-muted h-8 w-8 flex items-center justify-center rounded-md p-1"
                @click="toggleSettingsDialog">
                <div class="i-lucide-settings h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-1 flex-col overflow-hidden" >
      <header v-show="!headerState.hidden" class="h-14 flex items-center border-b-gray-200 dark:border-b-gray-800 border-b px-4 ">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ headerState.title }}</span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <TransitionGroup name="action">
            <template v-if="showActions">
              <button v-for="(action, index) in headerState.actions" :key="index"
                class="hover:bg-muted flex items-center gap-2 rounded-md px-3 py-2 transition-colors"
                @click="action.onClick">
                <div :class="action.icon" class="h-5 w-5" />
                <span v-if="action.name" class="text-sm">{{ action.name }}</span>
              </button>
            </template>
          </TransitionGroup>
          <button class="hover:bg-muted rounded-md p-2 transition-colors" @click="toggleActions">
            <div class="i-lucide-ellipsis h-5 w-5 transition-transform duration-300"
              :class="{ 'rotate-90': showActions }" />
          </button>
        </div>
      </header>
      <main class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-auto p-4">
          <slot v-bind="{ changeTitle, setActions, setHidden }" />
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
