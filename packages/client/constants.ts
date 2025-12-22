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
export const TELEGRAM_APP_ID = import.meta.env.VITE_TELEGRAM_API_ID || import.meta.env.VITE_TELEGRAM_APP_ID
export const TELEGRAM_APP_HASH = import.meta.env.VITE_TELEGRAM_API_HASH || import.meta.env.VITE_TELEGRAM_APP_HASH

export const DB_DEBUGGER_WS_URL = import.meta.env.VITE_DB_DEBUGGER_WS_URL
export const DB_DEBUG = import.meta.env.VITE_DB_DEBUG === 'true'
