import type { ITelegramClientAdapter } from '@tg-search/core'

export const exportMethods = ['getMessage', 'takeout'] as const
export type ExportMethod = typeof exportMethods[number]

export const commandStatus = ['pending', 'running', 'completed', 'failed', 'waiting'] as const
export type CommandStatus = typeof commandStatus[number]

/**
 * Base command interface representing a background task
 */
export interface Command {
  id: string
  type: 'export' | 'import' | 'stats' | 'sync' | 'search'
  status: CommandStatus
  progress: number
  message: string
  result?: unknown
  error?: Error
  metadata?: Record<string, unknown>
}

/**
 * Handler interface for executing command logic
 */
export interface CommandHandler {
  execute: (client: ITelegramClientAdapter, params: Record<string, unknown>) => Promise<void>
  onProgress?: (progress: number, message: string) => void
}

/**
 * Configuration options for command execution
 */
export interface CommandOptions {
  onProgress: (command: Command) => void
  onComplete: (command: Command) => void
  onError: (command: Command, error: Error) => void
}
