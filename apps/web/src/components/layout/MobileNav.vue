<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { MOBILE_NAV_ITEMS } from '../../constants'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

interface NavItem {
  key: string
  icon: string
  label: string
}

const navItems = computed<NavItem[]>(() => {
  return MOBILE_NAV_ITEMS.map(item => ({
    key: item.path,
    icon: item.icon,
    label: t(item.labelKey),
  }))
})

function handleItemClick(item: NavItem) {
  router.push(item.key)
}

// Animation logic
const navContainerRef = ref<HTMLElement | null>(null)
const itemRefs = ref<Map<string, HTMLElement>>(new Map())

function setItemRef(el: Element | ComponentPublicInstance | null, key: string) {
  if (el instanceof HTMLElement) {
    itemRefs.value.set(key, el)
  }
}

const activeIndicatorStyle = ref({
  width: '0px',
  height: '0px',
  transform: 'translate(0px, 0px)',
  opacity: 0,
})

const activeKey = computed(() => {
  // Find which nav item matches current path
  const item = navItems.value.find(i => route.path.startsWith(i.key))
  return item ? item.key : null
})

function updateIndicator() {
  const key = activeKey.value
  if (!key) {
    activeIndicatorStyle.value.opacity = 0
    return
  }

  const el = itemRefs.value.get(key)
  const container = navContainerRef.value

  if (el && container) {
    // Find the icon container div inside the button
    const iconDiv = el.querySelector('.nav-icon-container') as HTMLElement
    if (iconDiv) {
      const rect = iconDiv.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      activeIndicatorStyle.value = {
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate(${rect.left - containerRect.left}px, ${rect.top - containerRect.top}px)`,
        opacity: 1,
      }
    }
  }
}

watch(activeKey, () => {
  nextTick(updateIndicator)
}, { immediate: true })

// Also update on resize
let resizeSyncTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  window.addEventListener('resize', updateIndicator)
  resizeSyncTimer = setTimeout(updateIndicator, 100)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIndicator)
  if (resizeSyncTimer) {
    clearTimeout(resizeSyncTimer)
  }
})

const isChatPage = computed(() => {
  // Check if we are in a specific chat route (e.g. /chat/123)
  // But NOT /chats (the list)
  return route.path.startsWith('/chat/')
})
</script>

<template>
  <div
    v-if="!isChatPage"
    ref="navContainerRef"
    class="pb-safe fixed bottom-6 left-4 right-4 z-50 h-16 flex items-center justify-around border rounded-full bg-background/80 px-2 shadow-2xl backdrop-blur-xl transition-all duration-300 md:hidden"
  >
    <!-- Active Indicator Background -->
    <div
      class="absolute left-0 top-0 rounded-full bg-primary shadow-sm transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :style="activeIndicatorStyle"
    />

    <!-- Nav Items -->
    <button
      v-for="item in navItems"
      :key="item.key"
      :ref="(el) => setItemRef(el, item.key)"
      :aria-label="item.label"
      class="relative z-10 flex flex-1 flex-col items-center justify-center py-1 transition-colors duration-200 active:scale-90"
      :class="activeKey === item.key ? 'text-primary' : 'text-muted-foreground hover:text-foreground'"
      @click="handleItemClick(item)"
    >
      <div class="nav-icon-container flex items-center justify-center rounded-full p-2.5">
        <!-- Using dynamic class with explicit block display -->
        <span
          :class="[item.icon, activeKey === item.key ? 'text-primary-foreground' : '']"
          class="h-6 w-6 flex items-center justify-center leading-none transition-colors duration-200"
        />
      </div>
    </button>
  </div>
</template>
