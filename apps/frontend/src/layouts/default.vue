<script lang="ts" setup>
import type { CoreDialog } from '@tg-search/core'
import type { Action } from '../types/action'
import { useDark, useToggle } from '@vueuse/core'
import { onMounted, reactive, ref } from 'vue'
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
  actions: [],
})

const chats = ref<CoreDialog[]>([])
const router = useRouter()

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
            <input type="text" class="border-input bg-background ring-offset-background w-full border rounded-md px-3 py-2 pl-9 text-sm" placeholder="Search">
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
          <ChatGroup title="私聊" :chats="chats" @click="handleClick" />
        </div>
        <!-- Group Chats -->
        <div class="mt-4">
          <ChatGroup title="群聊" avatar="https://github.com/shadcn.png" />
        </div>
        <div class="mt-4">
          <ChatGroup title="群聊" avatar="https://github.com/shadcn.png" />
        </div>
        <!-- User profile -->
        <div class="mt-auto border-t p-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="bg-muted h-8 w-8 flex items-center justify-center overflow-hidden rounded-full">
                <img alt="Me" class="h-full w-full object-cover">
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
        <div class="ml-auto">
          <button class="hover:bg-muted rounded-md p-2">
            <div class="i-lucide-ellipsis h-5 w-5" />
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
