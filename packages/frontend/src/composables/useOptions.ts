import { useI18n } from 'vue-i18n'

export function useMessageTypeOptions() {
  const { t } = useI18n()

  const messageTypeOptions = [
    { label: t('component.export_command.text'), value: 'text' },
    { label: t('component.export_command.photo'), value: 'photo' },
    { label: t('component.export_command.video'), value: 'video' },
    { label: t('component.export_command.document'), value: 'document' },
    { label: t('component.export_command.sticker'), value: 'sticker' },
    { label: t('component.export_command.other'), value: 'other' },
  ]

  return messageTypeOptions
}

export function useChatTypeOptions() {
  const { t } = useI18n()

  const chatTypeOptions = [
    { label: t('component.export_command.user_chat'), value: 'user' },
    { label: t('component.export_command.group_chat'), value: 'group' },
    { label: t('component.export_command.channels_chat'), value: 'channel' },
  ]

  return chatTypeOptions
}

export function useExportMethodOptions() {
  const { t } = useI18n()

  const exportMethodOptions = [
    { label: t('component.export_command.getMessage'), value: 'getMessage' },
    { label: t('component.export_command.takeout'), value: 'takeout' },
  ]

  return exportMethodOptions
}
