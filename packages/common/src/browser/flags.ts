import { Format, LogLevel } from '@guiiai/logg'

export const flags = {
  logLevel: LogLevel.Verbose,
  logFormat: Format.Pretty,

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
          flags.logLevel = LogLevel.Debug
          flags.isDebugMode = true
          break
        case 'verbose':
          flags.logLevel = LogLevel.Verbose
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
