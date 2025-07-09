import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'
import ErrorStackParser from 'error-stack-parser'
import path from 'path-browserify-esm'

import { isBrowser } from './utils'

export type Logger = ReturnType<typeof useLogg>
export { Format as LoggerFormat, LogLevel as LoggerLevel }

export function initLogger(
  level = LogLevel.Verbose,
  format = Format.Pretty,
) {
  setGlobalLogLevel(level)
  setGlobalFormat(format)

  const logger = useLogg('logger').useGlobalConfig()
  logger.withFields({ level: LogLevel[level], format }).log('Logger initialized')
}

export function useLogger(name?: string): Logger {
  // eslint-disable-next-line unicorn/error-message
  const stack = ErrorStackParser.parse(new Error())
  const currentStack = stack[1]
  const basePath = currentStack.fileName?.replace('async', '').trim() || ''
  const fileName = path.join(...basePath.split(path.sep).slice(-2))

  const nameToDisplay = name || `${fileName}:${currentStack.lineNumber}`
  const hyperlink = !isBrowser() ? `\x1B]8;;file://${basePath}\x1B\\${nameToDisplay}\x1B]8;;\x1B\\` : nameToDisplay
  return useLogg(hyperlink).useGlobalConfig()
}
