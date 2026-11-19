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
    class="fixed bottom-0 left-0 right-0 z-40 flex items-stretch gap-1 border-t border-line-2 bg-container px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
  >
    <RouterLink
      v-for="item in navItems"
      :key="item.path"
      :to="item.path"
      :aria-current="activePath === item.path ? 'page' : undefined"
      class="h-14 flex flex-1 flex-col items-center justify-center gap-1 transition-colors"
      :class="activePath === item.path ? 'text-fg' : 'text-fg-3'"
    >
      <span
        class="h-7 w-12 flex items-center justify-center rounded-md transition-colors"
        :class="activePath === item.path ? 'bg-fill-2' : ''"
      >
        <span :class="NAV_ICON_CLASS[item.icon]" class="h-5 w-5" />
      </span>
      <span class="text-[11px] font-medium leading-none">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
