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
  <div class="w-full flex flex-col gap-3">
    <div class="text-nowrap text-sm text-fg font-medium">
      {{ t('base.toaster.pwaUpdateReady.message') }}
    </div>
    <div class="flex items-center justify-end gap-2">
      <Button size="sm" @click="() => handleNotNow()">
        {{ t('base.toaster.pwaUpdateReady.action.notNow') }}
      </Button>
      <Button variant="primary" size="sm" @click="() => handleUpdate()">
        {{ t('base.toaster.pwaUpdateReady.action.ok') }}
      </Button>
    </div>
  </div>
</template>
