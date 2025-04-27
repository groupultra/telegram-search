<script lang="ts" setup>
import { useDark, useToggle } from '@vueuse/core'

const isDark = useDark()
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

        <!-- Chats -->
        <!-- Private Chats -->
        <div class="mt-4">
          <div class="flex items-center justify-between px-4 py-2">
            <div class="flex items-center gap-1 text-sm font-medium">
              <div class="i-lucide-chevron-down h-4 w-4" />
              <span>私聊</span>
            </div>
            <button class="hover:bg-muted h-5 w-5 flex items-center justify-center rounded-md p-1">
              <div class="i-lucide-plus-circle h-4 w-4" />
            </button>
          </div>
          <ul class="px-2 space-y-1">
            <li v-for="id in 3" :key="`private-${id}`">
              <button class="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm">
                <div class="h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
                  <img :alt="`User ${id}`" class="h-full w-full object-cover">
                </div>
                <span>用户 {{ id }}</span>
              </button>
            </li>
          </ul>
        </div>
        <!-- Group Chats -->

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
              <button class="hover:bg-muted h-8 w-8 flex items-center justify-center rounded-md p-1">
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
          <div class="bg-gary-200 h-6 w-6 flex items-center justify-center overflow-hidden rounded-full">
            <img alt="Chat" class="h-full w-full object-cover">
          </div>
          <span class="font-medium">用户1</span>
        </div>
        <div class="ml-auto">
          <button class="hover:bg-muted rounded-md p-2">
            <div class="i-lucide-ellipsis h-5 w-5" />
          </button>
        </div>
      </header>
      <main class="flex flex-1 flex-col overflow-hidden">
        <div class="flex-1 overflow-auto p-4">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
