<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ scopes: string[] }>()

const { t } = useI18n()

// Identity scopes stay with the authorization server; only resource scopes describe data access.
const scopeKeys: Record<string, { key: string, icon: string }> = {
  'chats:read': { key: 'serverAuth.scopes.chatsRead', icon: 'i-lucide-messages-square' },
  'messages:read': { key: 'serverAuth.scopes.messagesRead', icon: 'i-lucide-message-square-text' },
  'media:read': { key: 'serverAuth.scopes.mediaRead', icon: 'i-lucide-image' },
  'database:admin': { key: 'serverAuth.scopes.databaseAdmin', icon: 'i-lucide-database' },
  'offline_access': { key: 'serverAuth.scopes.offlineAccess', icon: 'i-lucide-refresh-cw' },
}

const items = computed(() => props.scopes
  .filter(scope => scope in scopeKeys)
  .map(scope => ({ scope, ...scopeKeys[scope] })))
</script>

<template>
  <ul class="space-y-3">
    <li v-for="item in items" :key="item.scope" class="flex items-start gap-3 border border-line-2 rounded-lg bg-fill-3 px-4 py-3">
      <span :class="item.icon" class="mt-0.5 h-5 w-5 shrink-0 text-primary" />
      <div class="min-w-0">
        <p class="text-sm font-medium">
          {{ t(`${item.key}.title`) }}
        </p>
        <p class="text-sm text-fg-3">
          {{ t(`${item.key}.description`) }}
        </p>
      </div>
    </li>
  </ul>
</template>
