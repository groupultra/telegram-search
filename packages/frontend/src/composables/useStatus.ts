import type { CommandStatus } from '@tg-search/server'

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export function useStatus(status: CommandStatus) {
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

    const iconMap: Record<CommandStatus, string> = {
      pending: 'lucide:refresh-cw',
      running: 'lucide:loader',
      waiting: 'lucide:clock',
      completed: 'lucide:check',
      failed: 'lucide:x',
    }

    return iconMap[status]
  })

  return {
    statusText,
    statusIcon,
  }
}
