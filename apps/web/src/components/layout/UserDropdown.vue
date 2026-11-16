<script lang="ts" setup>
import { useAccountStore, useSessionStore } from '@tg-search/client'
import { useMediaQuery } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import {
  DrawerRoot as Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from 'vaul-vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import EntityAvatar from '../avatar/EntityAvatar.vue'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/DropdownMenu'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const isMobile = useMediaQuery('(max-width: 768px)')
const isOpen = ref(false)

const accountStore = useAccountStore()
const { isReady } = storeToRefs(accountStore)
const { activeSessionId } = storeToRefs(useSessionStore())
const { activeSession } = storeToRefs(useSessionStore())

function handleLoginLogout() {
  if (isReady.value) {
    accountStore.handleAuth().logout()
  }
  else {
    router.push({
      path: '/login',
      query: { redirect: route.fullPath },
    })
  }
}

function handleAddAccount() {
  accountStore.handleAuth().addNewAccount()
  router.push({
    path: '/login',
    query: { redirect: route.fullPath },
  })
}

function handleSwitchAccount(sessionId: string) {
  accountStore.handleAuth().switchAccount(sessionId)
}

const allAccounts = computed(() => accountStore.handleAuth().getAllAccounts())
</script>

<template>
  <!-- Mobile Drawer -->
  <Drawer v-if="isMobile" v-model:open="isOpen">
    <DrawerTrigger as-child>
      <slot>
        <button
          v-if="activeSession?.me?.id != null"
          class="h-8 w-8 overflow-hidden rounded-full transition-transform active:scale-95"
        >
          <EntityAvatar
            :id="activeSession.me.id"
            entity="self"
            entity-type="user"
            :name="activeSession.me.name"
            size="sm"
            class="h-full w-full"
          />
        </button>
        <button
          v-else
          class="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground transition-transform active:scale-95"
        >
          <span class="i-lucide-user h-4 w-4" />
        </button>
      </slot>
    </DrawerTrigger>
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        class="fixed bottom-0 left-0 right-0 z-50 mt-24 max-h-[80vh] flex flex-col border-t rounded-t-2xl bg-background outline-none"
      >
        <div class="flex-1 overflow-y-auto rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div class="mx-auto mb-6 h-1 w-10 flex-shrink-0 rounded-full bg-border" />

          <div class="mb-6 flex items-center gap-3 px-2">
            <EntityAvatar
              v-if="activeSession?.me?.id != null"
              :id="activeSession.me.id"
              entity="self"
              entity-type="user"
              :name="activeSession.me.name"
              size="lg"
              class="shrink-0"
            />
            <div class="min-w-0">
              <DrawerTitle class="truncate text-lg font-semibold tracking-tight">
                {{ activeSession?.me?.name || t('common.unknown') }}
              </DrawerTitle>
              <DrawerDescription class="text-xs text-muted-foreground font-mono">
                {{ activeSession?.me?.id }}
              </DrawerDescription>
            </div>
          </div>

          <div class="grid gap-2">
            <div class="px-2 py-1 eyebrow">
              {{ t('settings.switchAccount') }}
            </div>
            <button
              v-for="account in accountStore.handleAuth().getAllAccounts()"
              :key="account.uuid"
              class="flex items-center gap-3 rounded-lg p-2 text-left transition-colors active:bg-accent hover:bg-accent/60"
              @click="handleSwitchAccount(account.uuid); isOpen = false"
            >
              <EntityAvatar
                v-if="account.me?.id"
                :id="account.me.id"
                entity="other"
                entity-type="user"
                :name="account.me.name"
                size="md"
                class="shrink-0"
              />
              <div class="min-w-0 flex flex-1 flex-col items-start">
                <span class="truncate text-sm font-medium">{{ account.me?.name || t('common.unknown') }}</span>
                <span class="text-[11px] text-muted-foreground font-mono">{{ account.me?.id }}</span>
              </div>
              <span v-if="account.uuid === activeSessionId" class="i-lucide-check h-4 w-4 shrink-0" />
            </button>
          </div>

          <div class="grid mt-4 gap-1 border-t pt-4">
            <button
              class="flex items-center gap-3 rounded-lg p-2 text-sm text-foreground transition-colors active:bg-accent hover:bg-accent/60"
              @click="handleAddAccount"
            >
              <span class="h-10 w-10 flex items-center justify-center"><span class="i-lucide-plus h-4 w-4" /></span>
              {{ t('settings.addAccount') }}
            </button>

            <button
              class="flex items-center gap-3 rounded-lg p-2 text-sm text-destructive transition-colors active:bg-destructive/20 hover:bg-destructive/10"
              @click="handleLoginLogout"
            >
              <span class="h-10 w-10 flex items-center justify-center"><span class="i-lucide-log-out h-4 w-4" /></span>
              {{ isReady ? t('settings.logout') : t('login.login') }}
            </button>
          </div>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </Drawer>

  <!-- Desktop Dropdown -->
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <slot />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-64 rounded-xl p-1.5 shadow-lg"
      align="end"
      side="right"
      :side-offset="12"
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel class="px-2 py-1.5 eyebrow">
          {{ t('settings.switchAccount') }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="account in allAccounts"
          :key="account.uuid"
          class="cursor-pointer gap-2.5 rounded-lg px-2 py-1.5"
          @select="handleSwitchAccount(account.uuid)"
        >
          <EntityAvatar
            v-if="account.me?.id"
            :id="account.me.id"
            entity="other"
            entity-type="user"
            :name="account.me.name"
            size="sm"
            class="shrink-0"
          />
          <div class="min-w-0 flex flex-1 flex-col">
            <span class="truncate text-sm font-medium leading-tight">{{ account.me?.name || t('common.unknown') }}</span>
            <span class="truncate text-[11px] text-muted-foreground leading-tight font-mono">{{ account.me?.id }}</span>
          </div>
          <span
            v-if="account.uuid === activeSessionId"
            class="i-lucide-check h-4 w-4 shrink-0"
          />
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem class="cursor-pointer gap-2.5 rounded-lg px-2 py-2" @click="handleAddAccount">
          <span class="i-lucide-plus h-4 w-4 text-muted-foreground" />
          <span>{{ t('settings.addAccount') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem class="cursor-pointer gap-2.5 rounded-lg px-2 py-2 text-destructive focus:bg-destructive/10 focus:text-destructive" @click="handleLoginLogout">
          <span class="i-lucide-log-out h-4 w-4" />
          <span>{{ isReady ? t('settings.logout') : t('login.login') }}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
