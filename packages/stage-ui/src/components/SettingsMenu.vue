<script setup lang="ts">
import Avatar from './ui/Avatar.vue'
import SettingsSwitch from './ui/Switch/SettingsSwitch.vue'
import { ref, computed } from 'vue'
import { useDark } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import { useAuthStore, useBridgeStore, useSettingsStore } from '@tg-search/client'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from 'radix-vue'

const { t, locale } = useI18n()
const websocketStore = useBridgeStore()
const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const { logout } = authStore.handleAuth()

const settingsStore = useSettingsStore()
const { useCachedMessage, debugMode, language } = storeToRefs(settingsStore)

const isDark = useDark()
const isOpen = ref(false)

const languageOptions = computed(() => [
  { label: t('settings.chinese'), value: 'zhCN' },
  { label: t('settings.english'), value: 'en' },
])

const router = useRouter()

function handleLogin() {
  router.push('/login')
  isOpen.value = false
}

function handleLogout() {
  logout()
  isOpen.value = false
}
</script>

<template>
    <DropdownMenuRoot v-model:open="isOpen">
        <DropdownMenuTrigger as-child>
            <button class="i-lucide-menu hidden h-5 w-5 text-[var(--gs-color-text-muted)] md:block hover:text-[var(--gs-color-text-primary)]" />
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
            <DropdownMenuContent
                class="gs-bg-surface gs-border min-w-[200px] rounded-md p-2 shadow-lg"
                
            >
                <template v-if="isLoggedIn">
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <div class="flex items-center gap-2">
                            <Avatar :name="websocketStore.getActiveSession()?.me?.name" size="xs" />
                            <span class="gs-text-primary text-sm">{{ websocketStore.getActiveSession()?.me?.name }}</span>
                        </div>
                        <span class="text-xs gs-text-muted">ID: {{ websocketStore.getActiveSession()?.me?.id }}</span>
                    </div>

                    <DropdownMenuSeparator class="h-[1px] bg-[var(--gs-color-border)] my-2" />
                </template>

                <DropdownMenuSub>
                    <DropdownMenuSubTrigger class="flex items-center justify-between gap-2 rounded py-1.5 outline-none transition-colors data-[state=open]:bg-[var(--gs-color-surface-muted)] data-[highlighted]:bg-[var(--gs-color-surface-muted)] cursor-pointer">
                        <div class="flex items-center gap-2">
                            <div class="i-lucide-earth gs-text-primary"></div>
                            <span class="text-xs gs-text-primary">{{ t('settings.language') }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs gs-text-primary">{{ languageOptions.find(opt => opt.value === language)?.label }}</span>
                            <div class="i-lucide-chevron-right gs-text-muted"></div>
                        </div>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                        <DropdownMenuSubContent class="gs-bg-surface gs-border min-w-[120px] rounded-md p-1 shadow-lg" :side-offset="2" :align-offset="-5">
                            <DropdownMenuItem 
                                v-for="option in languageOptions" 
                                :key="option.value"
                                class="flex items-center gap-2 rounded px-2 py-1.5 outline-none transition-colors data-[highlighted]:bg-[var(--gs-color-surface-muted)] cursor-pointer"
                                @click="language = option.value"
                            >
                                <span class="text-xs gs-text-primary">{{ option.label }}</span>
                            </DropdownMenuItem>
                        </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                </DropdownMenuSub>

                <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-[var(--gs-color-surface-muted)]">
                    <div class="flex items-center gap-2">
                        <div class="i-lucide-moon gs-text-primary"></div>
                        <span class="text-xs gs-text-primary">{{ t('settings.darkMode') }}</span>
                    </div>
                    <SettingsSwitch v-model="isDark" size="sm" />
                </div>

                <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-[var(--gs-color-surface-muted)]">
                    <div class="flex items-center gap-2">
                        <div class="i-lucide-bug gs-text-primary"></div>
                        <span class="text-xs gs-text-primary">{{ t('settings.debugMode') }}</span>
                    </div>
                    <SettingsSwitch v-model="debugMode" size="sm" />
                </div>

                <div class="flex items-center justify-between gap-2 rounded py-1.5 transition-colors hover:bg-[var(--gs-color-surface-muted)]">
                    <div class="flex items-center gap-2">
                        <div class="i-lucide-database gs-text-primary"></div>
                        <span class="text-xs gs-text-primary">{{ t('settings.useCachedMessage') }}</span>
                    </div>
                    <SettingsSwitch v-model="useCachedMessage" size="sm" />
                </div>

                <DropdownMenuSeparator class="h-[1px] bg-[var(--gs-color-border)] my-2" />

                <template v-if="!isLoggedIn">
                    <DropdownMenuItem 
                        class="flex items-center gap-2 rounded py-1.5 outline-none transition-colors data-[highlighted]:bg-[var(--gs-color-surface-muted)] cursor-pointer"
                        @click="handleLogin"
                    >
                        <div class="i-lucide-log-in gs-text-primary"></div>
                        <span class="text-xs gs-text-primary">{{ t('settings.login') }}</span>
                    </DropdownMenuItem>
                </template>
                <template v-else>
                    <DropdownMenuItem 
                        class="flex items-center gap-2 rounded px-2 py-1.5 outline-none transition-colors data-[highlighted]:bg-[var(--gs-color-surface-muted)] cursor-pointer"
                        @click="handleLogout"
                    >
                        <div class="i-lucide-log-out gs-text-primary"></div>
                        <span class="text-xs gs-text-primary">{{ t('settings.logout') }}</span>
                    </DropdownMenuItem>
                </template>
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
