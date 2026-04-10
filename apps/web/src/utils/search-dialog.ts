import type { DialogType } from '@tg-search/core/types'

export type SearchMode = 'all' | 'messages' | 'photos' | 'commands'
export type SearchScope = 'current' | 'all'
export type SearchDialogChatTypeFilter = 'all' | DialogType

export interface SearchModeMeta {
  key: SearchMode
  label: string
  icon: string
}

export interface SearchChatTypeMeta {
  key: SearchDialogChatTypeFilter
  label: string
  icon: string
}

export interface SearchDialogCommandItem {
  id: string
  icon: string
  title: string
  description: string
  action: () => void
}

export function createSearchModes(t: (key: string) => string): SearchModeMeta[] {
  return [
    { key: 'all', label: t('searchDialog.modeAll'), icon: 'i-lucide-layers' },
    { key: 'messages', label: t('searchDialog.modeMessages'), icon: 'i-lucide-message-circle' },
    { key: 'photos', label: t('searchDialog.modePhotos'), icon: 'i-lucide-image' },
    { key: 'commands', label: t('searchDialog.modeCommands'), icon: 'i-lucide-settings' },
  ]
}

export function createSearchChatTypeFilters(t: (key: string) => string): SearchChatTypeMeta[] {
  return [
    { key: 'all', label: t('searchDialog.chatTypeAll'), icon: 'i-lucide-layers' },
    { key: 'user', label: t('searchDialog.chatTypeUser'), icon: 'i-lucide-user' },
    { key: 'bot', label: t('searchDialog.chatTypeBot'), icon: 'i-lucide-bot' },
    { key: 'group', label: t('searchDialog.chatTypeGroup'), icon: 'i-lucide-hash' },
    { key: 'supergroup', label: t('searchDialog.chatTypeSupergroup'), icon: 'i-lucide-message-circle' },
    { key: 'channel', label: t('searchDialog.chatTypeChannel'), icon: 'i-lucide-globe' },
  ]
}

interface CreateSearchDialogCommandsOptions {
  onClose: () => void
  onOpenAIChat: (chatIds: number[]) => void
  onOpenChats: () => void
  onOpenSettings: () => void
  onOpenSync: () => void
  scopedChatIds: number[]
  t: (key: string) => string
}

export function createSearchDialogCommands({
  onClose,
  onOpenAIChat,
  onOpenChats,
  onOpenSettings,
  onOpenSync,
  scopedChatIds,
  t,
}: CreateSearchDialogCommandsOptions): SearchDialogCommandItem[] {
  return [
    {
      id: 'ai-chat',
      icon: 'i-lucide-message-square-text',
      title: t('searchDialog.commandOpenAI'),
      description: t('searchDialog.commandOpenAIDesc'),
      action: () => {
        onOpenAIChat(scopedChatIds)
        onClose()
      },
    },
    {
      id: 'sync',
      icon: 'i-lucide-refresh-cw',
      title: t('searchDialog.commandSync'),
      description: t('searchDialog.commandSyncDesc'),
      action: () => {
        onOpenSync()
        onClose()
      },
    },
    {
      id: 'chats',
      icon: 'i-lucide-message-circle',
      title: t('searchDialog.commandChats'),
      description: t('searchDialog.commandChatsDesc'),
      action: () => {
        onOpenChats()
        onClose()
      },
    },
    {
      id: 'settings',
      icon: 'i-lucide-settings',
      title: t('searchDialog.commandSettings'),
      description: t('searchDialog.commandSettingsDesc'),
      action: () => {
        onOpenSettings()
        onClose()
      },
    },
  ]
}

export function filterSearchDialogCommands(items: SearchDialogCommandItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return items
  }

  return items.filter(item =>
    item.title.toLowerCase().includes(normalizedQuery)
    || item.description.toLowerCase().includes(normalizedQuery),
  )
}

export function matchesSearchChatTypeFilter(
  filter: SearchDialogChatTypeFilter,
  dialogType?: DialogType,
) {
  if (filter === 'all') {
    return true
  }

  // NOTICE: keep items whose dialog type could not be resolved (e.g. chat not
  // yet loaded in the store) so they are not silently dropped by the filter.
  if (!dialogType) {
    return true
  }

  return dialogType === filter
}
