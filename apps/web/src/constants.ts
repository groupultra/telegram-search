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
  icon: keyof typeof NAV_ICON_CLASS
  labelKey: string
}

// @unocss-include
export const NAV_ICON_CLASS = {
  'chats': 'i-lucide-messages-square',
  'ai-chat': 'i-lucide-sparkles',
  'settings': 'i-lucide-settings-2',
  'sync': 'i-lucide-refresh-cw',
} as const

export const SIDEBAR_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/sync', icon: 'sync', labelKey: 'sync.sync' },
  { path: '/ai-chat', icon: 'ai-chat', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'settings', labelKey: 'settings.settings' },
]

export const MOBILE_NAV_ITEMS: AppNavigationItem[] = [
  { path: '/chats', icon: 'chats', labelKey: 'layout.chats' },
  { path: '/sync', icon: 'sync', labelKey: 'sync.sync' },
  { path: '/ai-chat', icon: 'ai-chat', labelKey: 'aiChat.aiChat' },
  { path: '/settings', icon: 'settings', labelKey: 'settings.settings' },
]
