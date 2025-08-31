import { LoggerFormat, LoggerLevel } from '@unbird/logg'

export const flags = {
  logLevel: LoggerLevel.Verbose,
  logFormat: LoggerFormat.Pretty,

  isDebugMode: false,
  isDatabaseDebugMode: false,
}

export function parseEnvFlags(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    const lowerKey = key.toLowerCase()
    const lowerValue = value.toLowerCase()

    if (lowerKey === 'log_level') {
      switch (lowerValue) {
        case 'debug':
          flags.logLevel = LoggerLevel.Debug
          flags.isDebugMode = true
          break
        case 'verbose':
          flags.logLevel = LoggerLevel.Verbose
          break
      }
    }

    if (lowerKey === 'database_debug') {
      flags.isDatabaseDebugMode = lowerValue === 'true'
    }
  }

  // eslint-disable-next-line no-console
  console.log('Flags parsed', flags)
}
