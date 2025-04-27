<script lang="ts" setup>
import type { CoreDialog } from '@tg-search/core'
import type { Action } from '../types/action'
import { useDark, useToggle } from '@vueuse/core'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '../store/useSessionV2'

const sessionStore = useSessionStore()

const { getWsContext } = sessionStore
// const wsContext = getWsContext()

const settingsDialog = ref(false)

const headerState = reactive<{
  title: string
  actions: Action[]
}>({
  title: 'aa',
  actions: [
    {
      icon: 'i-lucide-plus',
      name: '新建',
      onClick: () => {
        console.log('plus')
      },
    },
    {
      icon: 'i-lucide-plus',
      name: '新建',
      onClick: () => {
        console.log('plus')
      },
    },
  ],
})

const search = ref('')

const chats = ref<CoreDialog[]>([])
const chatsFiltered = computed(() => {
  return chats.value.filter(chat => chat.name.includes(search.value))
})
const chatsFilteredPrivate = computed(() => {
  return chatsFiltered.value.filter(chat => chat.type === 'user')
})
const chatsFilteredGroup = computed(() => {
  return chatsFiltered.value.filter(chat => chat.type === 'group')
})
// channel
const chatsFilteredChannel = computed(() => {
  return chatsFiltered.value.filter(chat => chat.type === 'channel')
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

function setActions(actions: Action[]) {
  headerState.actions = actions
}

function handleClick(chat: CoreDialog) {
  router.push(`/chat/${chat.id}`)
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
    <div class="bg-background z-40 h-full w-64 border-r border-r-gray-200">
      <div class="h-full flex flex-col overflow-hidden">
        <div class="p-2">
          <div class="relative">
            <div class="i-lucide-search text-muted-foreground absolute left-2 top-1/2 h-4 w-4 text-xl -translate-y-1/2" />
            <input v-model="search" type="text" class="border-input bg-background ring-offset-background w-full border rounded-md px-3 py-2 pl-9 text-sm" placeholder="Search">
          </div>
        </div>
        <!-- Main menu -->
        <div class="mt-2 p-2">
          <ul class="space-y-1">
            <li>
              <button
                class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm"
              >
                <div class="i-lucide-home h-5 w-5" />
                <span>主页</span>
              </button>
            </li>
            <li>
              <button
                class="w-full flex items-center gap-3 rounded-md bg-cover px-3 py-2 text-sm hover:bg-gray-200"
              >
                <div class="i-lucide-folder-open h-5 w-5" />
                <span>嵌入</span>
              </button>
            </li>
            <li>
              <button
                class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-gray-200"
              >
                <div class="i-lucide-folder-sync h-5 w-5" />
                <span>同步</span>
              </button>
            </li>
          </ul>
        </div>
        <Dialog v-model="settingsDialog">
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="i-lucide-settings h-5 w-5" />
                <span>设置</span>
              </div>
            </div>
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="i-lucide-moon h-5 w-5" />
                <span>深色模式</span>
              </div>
              <Switch :model-value="isDark" @update:model-value="toggleDark" />
            </div>
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <div class="i-lucide-log-out h-5 w-5" />
                <span>退出登陆</span>
              </div>
              <button class="text-red-500">
                退出
              </button>
            </div>
          </div>
        </Dialog>

        <!-- Chats -->
        <!-- Private Chats -->
        <div class="mt-4">
          <ChatGroup title="私聊" :chats="chatsFilteredPrivate" @click="handleClick" />
        </div>
        <!-- Group Chats -->
        <div class="mt-4">
          <ChatGroup title="群聊" :chats="chatsFilteredGroup" @click="handleClick" />
        </div>
        <div class="mt-4">
          <ChatGroup title="频道" :chats="chatsFilteredChannel" @click="handleClick" />
        </div>
        <!-- User profile -->
        <div class="mt-auto border-t p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="bg-muted h-8 w-8 flex items-center justify-center overflow-hidden rounded-full">
                <img alt="Me" src="https://api.dicebear.com/6.x/bottts/svg?seed=RainbowBird" class="h-full w-full object-cover">
              </div>
              <div class="flex flex-col">
                <span class="text-sm font-medium">我的用户名</span>
                <span class="text-muted-foreground text-xs">已链接</span>
              </div>
            </div>
            <div class="flex items-center">
              <button class="hover:bg-muted h-8 w-8 flex items-center justify-center rounded-md p-1" @click="toggleSettingsDialog">
                <div class="i-lucide-settings h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="flex flex-1 flex-col overflow-hidden">
      <header class="h-14 flex items-center border-b px-4">
        <div class="flex items-center gap-2">
          <span class="font-medium">{{ headerState.title }}</span>
        </div>
        <div class="ml-auto flex items-center gap-2">
          <TransitionGroup name="action">
            <template v-if="showActions">
              <button
                v-for="(action, index) in headerState.actions"
                :key="index"
                class="hover:bg-muted flex items-center gap-2 rounded-md px-3 py-2 transition-colors"
                @click="action.onClick"
              >
                <div :class="action.icon" class="h-5 w-5" />
                <span v-if="action.name" class="text-sm">{{ action.name }}</span>
              </button>
            </template>
          </TransitionGroup>
          <button
            class="hover:bg-muted rounded-md p-2 transition-colors"
            @click="toggleActions"
          >
            <div
              class="i-lucide-ellipsis h-5 w-5 transition-transform duration-300"
              :class="{ 'rotate-90': showActions }"
            />
          </button>
        </div>
      </header>
      <main class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-auto p-4">
          <slot v-bind="{ changeTitle, setActions }" />
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
