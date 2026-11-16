<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

import { MOBILE_NAV_ITEMS, NAV_ICON_CLASS } from '../../constants'

const { t } = useI18n()
const route = useRoute()

const navItems = computed(() => {
  return MOBILE_NAV_ITEMS.map(item => ({
    ...item,
    label: t(item.labelKey),
  }))
})

const activePath = computed(() => {
  // Find which nav item matches current path
  return navItems.value.find(item => route.path.startsWith(item.path))?.path
})
</script>

<template>
  <!-- Hidden on a specific chat route (e.g. /chat/123), but NOT on /chats (the list) -->
  <nav
    v-if="!route.path.startsWith('/chat/')"
    class="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      :aria-current="activePath === item.path ? 'page' : undefined"
      class="relative h-14 flex flex-1 flex-col items-center justify-center gap-1 transition-colors active:bg-accent"
      :class="activePath === item.path ? 'text-foreground' : 'text-muted-foreground'"
    >
      <span
        v-if="activePath === item.path"
        class="absolute top-0 h-0.5 w-8 rounded-b-full bg-primary"
      />
      <span :class="NAV_ICON_CLASS[item.icon]" class="h-5 w-5" />
      <span class="text-[10px] leading-none" :class="activePath === item.path ? 'font-semibold' : 'font-medium'">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
