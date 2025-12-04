import { LoggerLevel } from '@guiiai/logg'

export const LOG_LEVEL
  = import.meta.env.VITE_LOG_LEVEL === 'debug'
    ? LoggerLevel.Debug
    : import.meta.env.VITE_LOG_LEVEL === 'verbose'
      ? LoggerLevel.Verbose
      : LoggerLevel.Log
