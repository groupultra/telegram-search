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

const username = computed(() => activeSession.value?.me?.name)
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
        class="fixed bottom-0 left-0 right-0 z-50 mt-24 h-[62vh] max-h-[62vh] flex flex-col rounded-t-[10px] bg-background outline-none"
      >
        <div class="flex-1 rounded-t-[10px] bg-background p-4">
          <div class="mx-auto mb-8 h-1.5 w-12 flex-shrink-0 rounded-full bg-muted" />

          <div class="mb-6 flex flex-col items-center gap-4">
            <EntityAvatar
              v-if="activeSession?.me?.id != null"
              :id="activeSession.me.id"
              entity="self"
              entity-type="user"
              :name="activeSession.me.name"
              size="lg"
              class="h-24 w-24 shadow-xl ring-4 ring-background"
            />
            <div class="text-center">
              <DrawerTitle class="text-2xl font-bold">
                {{ activeSession?.me?.name || t('common.unknown') }}
              </DrawerTitle>
              <DrawerDescription class="text-muted-foreground">
                ID: {{ activeSession?.me?.id }}
              </DrawerDescription>
            </div>
          </div>

          <div class="grid gap-2">
            <div class="px-2 py-1 text-sm text-muted-foreground font-medium">
              {{ t('settings.switchAccount') }}
            </div>
            <button
              v-for="account in accountStore.handleAuth().getAllAccounts()"
              :key="account.uuid"
              class="flex items-center gap-4 rounded-xl p-3 transition-colors active:bg-muted hover:bg-muted/50"
              :class="{ 'bg-muted/30': account.uuid === activeSessionId }"
              @click="handleSwitchAccount(account.uuid); isOpen = false"
            >
              <EntityAvatar
                v-if="account.me?.id"
                :id="account.me.id"
                entity="other"
                entity-type="user"
                :name="account.me.name"
                size="md"
                class="h-12 w-12 ring-2 ring-border/20"
              />
              <div class="flex flex-1 flex-col items-start gap-1">
                <span class="font-semibold">{{ account.me?.name || t('common.unknown') }}</span>
                <span class="text-xs text-muted-foreground font-mono">ID: {{ account.me?.id }}</span>
              </div>
              <div v-if="account.uuid === activeSessionId" class="h-3 w-3 rounded-full bg-primary shadow-sm" />
            </button>
          </div>

          <div class="grid mt-8 gap-2">
            <button
              class="flex items-center gap-3 rounded-xl p-3 text-foreground font-medium transition-colors active:bg-muted hover:bg-muted/50"
              @click="handleAddAccount"
            >
              <div class="h-10 w-10 flex items-center justify-center rounded-full bg-muted">
                <span class="i-lucide-plus h-5 w-5" />
              </div>
              {{ t('settings.addAccount') }}
            </button>

            <button
              class="flex items-center gap-3 rounded-xl p-3 text-destructive font-medium transition-colors active:bg-destructive/20 hover:bg-destructive/10"
              @click="handleLoginLogout"
            >
              <div class="h-10 w-10 flex items-center justify-center rounded-full bg-destructive/10">
                <span class="i-lucide-log-out h-5 w-5" />
              </div>
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
      class="max-w-[296px] min-w-[296px] w-[296px] border-border/60 rounded-3xl bg-background/96 p-3 shadow-2xl backdrop-blur-xl"
      align="start"
      side="top"
      :side-offset="0"
    >
      <div class="mb-3 flex items-center gap-4 rounded-2xl bg-muted/30 p-4">
        <EntityAvatar
          v-if="activeSession?.me?.id != null"
          :id="activeSession?.me?.id"
          entity="self"
          entity-type="user"
          :name="username"
          size="lg"
          class="h-16 w-16 shrink-0 ring-4 ring-background"
        />
        <div class="min-w-0 flex flex-1 flex-col">
          <span class="truncate text-xl font-bold">{{ username || t('common.unknown') }}</span>
          <span class="truncate text-sm text-muted-foreground font-mono">ID: {{ activeSession?.me?.id }}</span>
        </div>
        <div class="h-3 w-3 rounded-full bg-primary shadow-sm" />
      </div>

      <DropdownMenuGroup class="grid gap-1">
        <DropdownMenuLabel class="px-2 py-1 text-sm text-muted-foreground font-medium">
          {{ t('settings.switchAccount') }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="account in allAccounts"
          :key="account.uuid"
          class="cursor-pointer rounded-2xl p-0 focus:bg-transparent focus:text-foreground"
          @select="handleSwitchAccount(account.uuid)"
        >
          <div
            class="w-full flex items-center gap-4 rounded-2xl p-3 transition-colors"
            :class="account.uuid === activeSessionId ? 'bg-muted/40' : 'hover:bg-muted/30'"
          >
            <EntityAvatar
              v-if="account.me?.id"
              :id="account.me.id"
              entity="other"
              entity-type="user"
              :name="account.me.name"
              size="md"
              class="h-12 w-12 shrink-0 ring-2 ring-border/20"
            />
            <div class="min-w-0 flex flex-1 flex-col gap-1">
              <span class="truncate text-base font-semibold">{{ account.me?.name || t('common.unknown') }}</span>
              <span class="truncate text-xs text-muted-foreground font-mono">ID: {{ account.me?.id }}</span>
            </div>
            <div
              v-if="account.uuid === activeSessionId"
              class="h-3 w-3 shrink-0 rounded-full bg-primary shadow-sm"
            />
          </div>
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator class="my-3" />

      <DropdownMenuGroup class="grid gap-2">
        <DropdownMenuItem class="cursor-pointer rounded-2xl p-0 focus:bg-transparent focus:text-foreground" @click="handleAddAccount">
          <div class="w-full flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-muted/30">
            <div class="h-10 w-10 flex items-center justify-center rounded-full bg-muted">
              <span class="i-lucide-plus h-5 w-5" />
            </div>
            <span class="text-sm font-medium">{{ t('settings.addAccount') }}</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem class="cursor-pointer rounded-2xl p-0 focus:bg-transparent focus:text-destructive" @click="handleLoginLogout">
          <div class="w-full flex items-center gap-3 rounded-2xl p-3 text-destructive transition-colors hover:bg-destructive/10">
            <div class="h-10 w-10 flex items-center justify-center rounded-full bg-destructive/10">
              <span class="i-lucide-log-out h-5 w-5" />
            </div>
            <span class="text-sm font-medium">{{ isReady ? t('settings.logout') : t('login.login') }}</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
