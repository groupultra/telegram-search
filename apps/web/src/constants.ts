import { LoggerLevel } from '@guiiai/logg'

// TODO: use IS_CORE_MODE from @tg-search/client
export const IS_CORE_MODE = import.meta.env.VITE_WITH_CORE
export const LOG_LEVEL
  = import.meta.env.VITE_LOG_LEVEL === 'debug'
    ? LoggerLevel.Debug
    : import.meta.env.VITE_LOG_LEVEL === 'verbose'
      ? LoggerLevel.Verbose
      : LoggerLevel.Log

export interface AppNavigationItem {
  path: string
  icon: string
  labelKey: string
}

export const SIDEBAR_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/sync', icon: 'i-lucide-refresh-cw', labelKey: 'sync.sync' },
  { path: '/search', icon: 'i-lucide-search', labelKey: 'search.search' },
  { path: '/ai-chat', icon: 'i-lucide-message-square-text', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'i-lucide-settings', labelKey: 'settings.settings' },
]

export const MOBILE_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/sync', icon: 'i-lucide-refresh-cw', labelKey: 'sync.sync' },
  { path: '/search', icon: 'i-lucide-search', labelKey: 'search.search' },
  { path: '/chats', icon: 'i-lucide-message-circle', labelKey: 'chatGroups.all' },
  { path: '/ai-chat', icon: 'i-lucide-bot', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'i-lucide-settings', labelKey: 'settings.settings' },
]
