import { useI18n } from 'vue-i18n'

export function formatNumberToReadable(num: number | undefined): string {
  if (num === undefined)
    return '0'
  return num.toLocaleString()
}

export function formatTimeToReadable(seconds: number | string): string {
  const { t } = useI18n()

  if (typeof seconds === 'string') {
    seconds = Number.parseFloat(seconds)
  }

  if (!seconds || seconds < 0)
    return t('component.export_command.unknown')

  if (seconds < 60) {
    return `${Math.floor(seconds)}秒`
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return t('component.export_command.minutes', {
      minutes,
      second: remainingSeconds,
    })
  }

  const hours = Math.floor(seconds / 3600)
  const remainingMinutes = Math.floor((seconds % 3600) / 60)
  return t('component.export_command.hours', {
    minutes: remainingMinutes,
    hours,
  })
}

export function formatSpeedToReadable(messagesPerSecond: number | string): string {
  const { t } = useI18n()

  if (typeof messagesPerSecond === 'string') {
    messagesPerSecond = Number.parseFloat(messagesPerSecond)
  }

  if (messagesPerSecond >= 1) {
    return t('component.export_command.per_second', {
      per_second: messagesPerSecond,
    })
  }

  const messagesPerMinute = messagesPerSecond * 60
  return t('component.export_command.per_second', {
    per_minute: messagesPerMinute,
  })
}
