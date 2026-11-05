import { resolveTelegramCredentials } from '@tg-search/common'

export const API_BASE = '/api'
export const WS_API_BASE = '/ws'

export const API_CONFIG = {
  TIMEOUT: 30000,
  RETRY_POLICY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 1000,
  },
}

export const DEV_MODE = import.meta.env.DEV
export const DEBUG_MODE = import.meta.env.VITE_DEBUG === 'true'
export const IS_CORE_MODE = import.meta.env.VITE_WITH_CORE
// Browser-only mode falls back to the built-in app when the VITE_* pair is incomplete.
const telegramCredentials = resolveTelegramCredentials([{
  apiId: import.meta.env.VITE_TELEGRAM_API_ID || import.meta.env.VITE_TELEGRAM_APP_ID,
  apiHash: import.meta.env.VITE_TELEGRAM_API_HASH || import.meta.env.VITE_TELEGRAM_APP_HASH,
  source: 'environment',
}])
export const TELEGRAM_APP_ID = telegramCredentials.apiId
export const TELEGRAM_APP_HASH = telegramCredentials.apiHash

export const DB_DEBUGGER_WS_URL = import.meta.env.VITE_DB_DEBUGGER_WS_URL
export const DB_DEBUG = import.meta.env.VITE_DB_DEBUG === 'true'
