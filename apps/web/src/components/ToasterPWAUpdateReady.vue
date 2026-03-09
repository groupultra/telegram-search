<script setup lang="ts">
import { useLogger } from '@guiiai/logg'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from './ui/Button'

const props = defineProps<{ id?: string }>()
const emits = defineEmits<{ (e: 'update'): void }>()
const ToasterRootInjectionKey = Symbol('ToasterRoot')
const { t } = useI18n()

const toastRoot = inject(ToasterRootInjectionKey, { close: (id: string) => useLogger('pwa').withFields({ id }).warn('No toast root provided, cannot close toast') })

function handleUpdate() {
  emits('update')
  toastRoot.close(props.id || '')
}

function handleNotNow() {
  toastRoot.close(props.id || '')
}
</script>

<template>
  <div
    w-full flex flex-col gap-1 rounded-xl
  >
    <div mb-1 text-nowrap>
      {{ t('base.toaster.pwaUpdateReady.message') }}
    </div>
    <div w-full flex items-center gap-2>
      <Button
        icon="i-lucide-x-circle"
        w-full
        size="sm"
        aria-label="Not now"
        @click="() => handleNotNow()"
      >
        <div text-nowrap>
          {{ t('base.toaster.pwaUpdateReady.action.notNow') }}
        </div>
      </Button>
      <Button
        icon="i-lucide-check-circle"
        w-full
        size="sm"
        aria-label="Update"
        @click="() => handleUpdate()"
      >
        <div text-nowrap>
          {{ t('base.toaster.pwaUpdateReady.action.ok') }}
        </div>
      </Button>
    </div>
  </div>
</template>
