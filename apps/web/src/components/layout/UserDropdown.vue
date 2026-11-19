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
import { ListItem } from '../ui/ListItem'

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
        <button type="button" class="h-8 w-8 overflow-hidden rounded-full">
          <EntityAvatar
            v-if="activeSession?.me?.id != null"
            :id="activeSession.me.id"
            entity="self"
            entity-type="user"
            :name="activeSession.me.name"
            size="sm"
          />
          <span v-else class="h-8 w-8 flex items-center justify-center rounded-full bg-fill-2 text-fg-3">
            <span class="i-lucide-user h-4 w-4" />
          </span>
        </button>
      </slot>
    </DrawerTrigger>
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-mask" />
      <DrawerContent
        class="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] flex flex-col rounded-t-lg bg-elevated text-fg shadow-modal outline-none"
      >
        <div class="flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <div class="mx-auto mb-4 h-1 w-9 flex-shrink-0 rounded-full bg-fill" />

          <div class="mb-3 flex items-center gap-3 px-3">
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
              <DrawerTitle class="truncate text-base font-semibold leading-6">
                {{ activeSession?.me?.name || t('common.unknown') }}
              </DrawerTitle>
              <DrawerDescription class="text-xs text-fg-3">
                ID {{ activeSession?.me?.id }}
              </DrawerDescription>
            </div>
          </div>

          <div class="px-3 pb-1.5 pt-2 eyebrow">
            {{ t('settings.switchAccount') }}
          </div>
          <div class="flex flex-col gap-0.5">
            <ListItem
              v-for="account in allAccounts"
              :key="account.uuid"
              :description="`ID ${account.me?.id ?? ''}`"
              @click="handleSwitchAccount(account.uuid); isOpen = false"
            >
              <template #prefix>
                <EntityAvatar
                  v-if="account.me?.id"
                  :id="account.me.id"
                  entity="other"
                  entity-type="user"
                  :name="account.me.name"
                  size="sm"
                  class="shrink-0"
                />
              </template>
              <span class="text-fg">{{ account.me?.name || t('common.unknown') }}</span>
              <template v-if="account.uuid === activeSessionId" #suffix>
                <span class="i-lucide-check h-4 w-4 shrink-0 text-fg" />
              </template>
            </ListItem>
          </div>

          <div class="mx-1 my-1 h-px bg-line-2" />

          <div class="flex flex-col gap-0.5">
            <ListItem icon="i-lucide-plus" class="min-h-10" @click="handleAddAccount">
              {{ t('settings.addAccount') }}
            </ListItem>
            <ListItem icon="i-lucide-log-out" class="min-h-10 text-destructive! hover:bg-destructive/12!" @click="handleLoginLogout">
              {{ isReady ? t('settings.logout') : t('login.login') }}
            </ListItem>
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
      class="w-64"
      align="end"
      side="right"
      :side-offset="8"
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          {{ t('settings.switchAccount') }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          v-for="account in allAccounts"
          :key="account.uuid"
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
            <span class="truncate text-sm leading-5">{{ account.me?.name || t('common.unknown') }}</span>
            <span class="truncate text-xs text-fg-3 leading-4">ID {{ account.me?.id }}</span>
          </div>
          <span
            v-if="account.uuid === activeSessionId"
            class="i-lucide-check h-4 w-4 shrink-0"
          />
        </DropdownMenuItem>
      </DropdownMenuGroup>

      <DropdownMenuSeparator />

      <DropdownMenuGroup>
        <DropdownMenuItem @click="handleAddAccount">
          <span class="i-lucide-plus h-4 w-4 text-fg-2" />
          <span>{{ t('settings.addAccount') }}</span>
        </DropdownMenuItem>
        <DropdownMenuItem class="text-destructive data-[highlighted]:bg-destructive/12" @click="handleLoginLogout">
          <span class="i-lucide-log-out h-4 w-4" />
          <span>{{ isReady ? t('settings.logout') : t('login.login') }}</span>
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
