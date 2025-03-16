import type { CommandsMetadataMap, CommandsParamsMap, CommandsResultMap } from './commands'

export type CommandStatus = 'pending' | 'running' | 'completed' | 'failed'
export type CommandType = 'export' | 'import' | 'embed' | 'search' | 'syncMetadata' | 'syncChats'

export type CommandMetadata<T extends CommandType> = CommandsMetadataMap[T]
export type CommandParams<T extends CommandType> = CommandsParamsMap[T]
export type CommandResult<T extends CommandType> = CommandsResultMap[T]

interface BaseCommand {
  id: string
  type: CommandType
  status: CommandStatus
}

interface WithProgress {
  progress: number
  message: string
}

interface WithResult<R extends CommandType> {
  result: CommandResult<R>
}

interface WithError {
  error: Error
}

interface WithMetadata<T extends CommandType> {
  metadata: CommandMetadata<T>
}

// Pending
export interface PendingCommand extends BaseCommand { status: 'pending' }

// Running
export interface ProgressCommand extends BaseCommand, WithProgress { status: 'running' }
export type ProgressCommandWithMetadata<T extends CommandType> = ProgressCommand & WithMetadata<T>

// Completed
export interface ResultCommand<T extends CommandType> extends BaseCommand, WithResult<T> { status: 'completed' }
export type ResultCommandWithMetadata<T extends CommandType> = ResultCommand<T> & WithMetadata<T>

// Failed
export interface ErrorCommand extends BaseCommand, WithError { status: 'failed' }
export type ErrorCommandWithMetadata<T extends CommandType> = ErrorCommand & WithMetadata<T>
