<script setup lang="ts">
import QRCode from 'qrcode'

import { useAccountStore } from '@tg-search/client'
import { useNow } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { Button } from '../../components/ui/Button'

const emit = defineEmits<{ retry: [], phone: [] }>()
const { t } = useI18n()
const accountStore = useAccountStore()
const qr = computed(() => accountStore.qrLogin.state)
const now = useNow({ interval: 1000 })
const image = ref('')
const renderError = ref(false)
const valid = computed(() => qr.value.status === 'scanning' && qr.value.expires * 1000 > now.value.getTime())
const failed = computed(() => renderError.value || qr.value.status === 'error')

watch(() => qr.value.url, async (url, _, onCleanup) => {
  let stale = false
  onCleanup(() => {
    stale = true
  })
  image.value = ''
  renderError.value = false
  if (!url)
    return
  try {
    const result = await QRCode.toDataURL(url, { width: 240, margin: 4, errorCorrectionLevel: 'M' })
    if (!stale)
      image.value = result
  }
  catch {
    if (!stale)
      renderError.value = true
  }
}, { immediate: true })
</script>

<template>
  <div class="flex flex-col items-center gap-5">
    <div class="h-60 w-60 flex items-center justify-center rounded-xl bg-white" aria-live="polite">
      <img v-if="valid && image && !failed" :src="image" :alt="t('login.qrTitle')" width="240" height="240" class="rounded-xl">
      <p v-else-if="failed || qr.status === 'expired'" role="alert" class="px-5 text-center text-sm text-slate-700">
        {{ failed ? t('login.qrError') : t('login.qrExpired') }}
      </p>
      <span v-else class="i-lucide-loader-2 h-8 w-8 animate-spin text-slate-600" :aria-label="t('login.processing')" role="status" />
    </div>
    <ol class="max-w-xs list-decimal pl-5 text-sm text-muted-foreground space-y-2">
      <li>{{ t('login.qrOpenTelegram') }}</li>
      <li>{{ t('login.qrOpenDevices') }}</li>
      <li>{{ t('login.qrScan') }}</li>
    </ol>
    <Button v-if="failed || qr.status === 'expired'" type="button" @click="emit('retry')">
      {{ t('login.qrRetry') }}
    </Button>
    <p v-else class="text-xs text-muted-foreground" aria-live="polite">
      {{ t('login.qrAutoRefresh') }}
    </p>
    <Button type="button" variant="ghost" @click="emit('phone')">
      {{ t('login.usePhone') }}
    </Button>
  </div>
</template>
