import { LoggerFormat, LoggerLevel } from '@guiiai/logg'

import { readBooleanEnv, readEnvValue } from './env'

export interface RuntimeFlags {
  logLevel: LoggerLevel
  logFormat: LoggerFormat

  isDebugMode: boolean
  isDatabaseDebugMode: boolean
  disableMigrations: boolean
}

const DEFAULT_FLAGS: RuntimeFlags = {
  logLevel: LoggerLevel.Verbose,
  logFormat: LoggerFormat.Pretty,

  isDebugMode: false,
  isDatabaseDebugMode: false,
  disableMigrations: false,
}

export function parseEnvFlags(env: Record<string, string | undefined>): RuntimeFlags {
  const result: RuntimeFlags = { ...DEFAULT_FLAGS }

  const logLevelValue = readEnvValue('LOG_LEVEL', env)
  if (logLevelValue) {
    const normalized = logLevelValue.toLowerCase()
    switch (normalized) {
      case 'debug':
        result.logLevel = LoggerLevel.Debug
        result.isDebugMode = true
        break
      case 'verbose':
        result.logLevel = LoggerLevel.Verbose
        result.isDebugMode = false
        break
    }
  }

  result.disableMigrations = readBooleanEnv('DISABLE_MIGRATIONS', env)
  result.isDatabaseDebugMode = readBooleanEnv('DATABASE_DEBUG', env)

  // Since the logger is not initialized yet, we use console.log
  // eslint-disable-next-line no-console
  console.log('Flags parsed', result)

  return result
}
