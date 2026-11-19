<script setup lang="ts">
import { Primitive, TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui'

// Attributes (including ones merged by an outer `as-child` trigger such as a
// popover or menu) are forwarded to the slotted element, so Tooltip can wrap a
// trigger without breaking it.
defineOptions({ inheritAttrs: false })

defineProps<{
  content?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}>()
</script>

<template>
  <!-- Without content this renders the trigger only, so callers need no v-if. -->
  <Primitive v-if="!content" as-child v-bind="$attrs">
    <slot />
  </Primitive>
  <TooltipRoot v-else>
    <TooltipTrigger as-child v-bind="$attrs">
      <slot />
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent
        :side="side"
        :side-offset="6"
        class="z-60 max-w-80 animate-in rounded-sm bg-elevated px-2 py-1 text-xs text-fg-2 leading-[1.2] shadow-[var(--shadow-sm),var(--ring-line)] duration-150 fade-in-0 zoom-in-95"
      >
        {{ content }}
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>
