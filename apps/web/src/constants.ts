import { LoggerLevel } from '@guiiai/logg'

// TODO: use IS_CORE_MODE from @tg-search/client
export const IS_CORE_MODE = import.meta.env.VITE_WITH_CORE
export const LOG_LEVEL
  = import.meta.env.VITE_LOG_LEVEL === 'debug'
    ? LoggerLevel.Debug
    : import.meta.env.VITE_LOG_LEVEL === 'verbose'
      ? LoggerLevel.Verbose
      : LoggerLevel.Log
