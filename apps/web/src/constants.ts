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
  icon: 'sync' | 'chats' | 'ai-chat' | 'settings'
  labelKey: string
}

export const SIDEBAR_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/sync', icon: 'sync', labelKey: 'sync.sync' },
  { path: '/ai-chat', icon: 'ai-chat', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'settings', labelKey: 'settings.settings' },
]

export const MOBILE_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/sync', icon: 'sync', labelKey: 'sync.sync' },
  { path: '/chats', icon: 'chats', labelKey: 'chatGroups.all' },
  { path: '/ai-chat', icon: 'ai-chat', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'settings', labelKey: 'settings.settings' },
]
