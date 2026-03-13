export type SearchMode = 'all' | 'messages' | 'photos' | 'commands'
export type SearchScope = 'current' | 'all'

export interface SearchModeMeta {
  key: SearchMode
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
    { key: 'all', label: t('searchDialog.modeAll'), icon: 'i-lucide-grid-2x2' },
    { key: 'messages', label: t('searchDialog.modeMessages'), icon: 'i-lucide-message-square' },
    { key: 'photos', label: t('searchDialog.modePhotos'), icon: 'i-lucide-image' },
    { key: 'commands', label: t('searchDialog.modeCommands'), icon: 'i-lucide-command' },
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
