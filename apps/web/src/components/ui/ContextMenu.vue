<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

interface MenuItem {
  label: string
  icon?: string
  action: () => void
  disabled?: boolean
}

interface Props {
  items: MenuItem[]
  x?: number
  y?: number
}

const props = withDefaults(defineProps<Props>(), {
  x: 0,
  y: 0,
})

const isOpen = defineModel<boolean>('open', { default: false })

const menuRef = ref<HTMLElement | null>(null)
const menuStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
}))

onClickOutside(menuRef, () => {
  isOpen.value = false
})

watch(isOpen, (value) => {
  if (!value)
    return

  // Adjust position if menu is off-screen
  setTimeout(() => {
    if (!menuRef.value)
      return

    const rect = menuRef.value.getBoundingClientRect()
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    let adjustedX = props.x
    let adjustedY = props.y

    if (rect.right > windowWidth)
      adjustedX = windowWidth - rect.width - 10

    if (rect.bottom > windowHeight)
      adjustedY = windowHeight - rect.height - 10

    if (adjustedX !== props.x || adjustedY !== props.y) {
      Object.assign(menuRef.value.style, {
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
      })
    }
  }, 0)
})

function handleItemClick(item: MenuItem) {
  if (item.disabled)
    return

  item.action()
  isOpen.value = false
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        ref="menuRef"
        class="bg-popover fixed z-[100] min-w-[160px] overflow-hidden border rounded-lg shadow-lg"
        :style="menuStyle"
      >
        <div class="p-1">
          <button
            v-for="(item, index) in items"
            :key="index"
            class="hover:bg-accent hover:text-accent-foreground w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="item.disabled"
            @click="handleItemClick(item)"
          >
            <span v-if="item.icon" :class="item.icon" class="h-4 w-4" />
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
