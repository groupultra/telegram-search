import type { Command } from '@tg-search/server'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useStatus(status: Command['status']) {
  const statusText = computed((): string => {
    const { t } = useI18n()

    if (!status) {
      return t('component.export_command.preparation_guide')
    }

    const statusMap: Record<string, string> = {
      running: t('component.export_command.running'),
      waiting: t('component.export_command.waiting'),
      completed: t('component.export_command.completed'),
      failed: t('component.export_command.failed'),
      default: t('component.export_command.preparation_guide'),
    }

    return statusMap[status] || statusMap.default
  })

  const statusIcon = computed((): string => {
    if (!status)
      return ''

    const iconMap: Record<string, string> = {
      running: 'i-lucide-loader',
      waiting: 'i-lucide-clock',
      completed: 'i-lucide-check',
      failed: 'i-lucide-x',
      default: 'i-lucide-refresh-cw',
    }

    return iconMap[status] || iconMap.default
  })

  return {
    statusText,
    statusIcon,
  }
}
