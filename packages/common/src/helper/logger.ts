import path from 'node:path'
import { Format, LogLevel, setGlobalFormat, setGlobalLogLevel, useLogg } from '@guiiai/logg'

export type Logger = ReturnType<typeof useLogg>

export function initLogger() {
  setGlobalLogLevel(LogLevel.Debug)
  setGlobalFormat(Format.Pretty)

  const logger = useLogg('logger').useGlobalConfig()
  logger.log('Logger initialized')
}

/**
 * Get logger instance with directory name and filename
 * @returns logger instance configured with "directoryName/filename"
 */
export function useLogger(name?: string): Logger {
  const stack = new Error('logger').stack
  const caller = stack?.split('\n')[2]

  // Extract directory, filename and line number from stack trace
  const match = caller?.match(/(?:([^/]+)\/)?([^/\s]+?)(?:\.[jt]s)?:(\d+)(?::\d+)?\)?$/)
  const dirName = match?.[1] || path.basename(path.dirname(__filename))
  const fileName = match?.[2] || path.basename(__filename, '.ts')
  const lineNumber = match?.[3] || '?'

  if (name)
    return useLogg(`${name}] [${dirName}/${fileName}:${lineNumber}`).useGlobalConfig()

  return useLogg(`${dirName}/${fileName}:${lineNumber}`).useGlobalConfig()
}
