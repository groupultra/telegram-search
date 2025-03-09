import type { ClientAdapter, TelegramAdapter } from '@tg-search/core'

/**
 * Command option interface
 */
interface CommandOption {
  // Option flags (e.g. '-p, --path <path>')
  flags: string
  // Option description
  description: string
}

/**
 * Command metadata interface
 */
interface CommandMeta {
  // Command name
  name: string
  // Command description
  description: string
  // Command usage example
  usage?: string
  // Command options
  options?: CommandOption[]
  // Whether the command requires Telegram connection
  requiresConnection?: boolean
  // Whether the command can be run in background
  isBackground?: boolean
  // Whether the command requires client adapter
  requiresClient?: boolean
}

/**
 * Base command interface
 */
export interface Command {
  // Command metadata
  meta: CommandMeta
  // Command execution function
  execute: (args: string[], options: Record<string, any>) => Promise<void>
  // Optional client setter
  setClient?: (client: TelegramAdapter) => void
}

/**
 * Base command class with Telegram client
 */
export abstract class TelegramCommand<T extends TelegramAdapter = ClientAdapter> implements Command {
  protected client?: T

  abstract meta: CommandMeta
  abstract execute(args: string[], options: Record<string, any>): Promise<void>

  /**
   * Set Telegram client
   */
  setClient(client: TelegramAdapter) {
    // Check if command requires client adapter
    if (this.meta.requiresClient && client.type === 'bot') {
      throw new Error('This command requires client adapter')
    }
    this.client = client as T
  }

  /**
   * Get Telegram client
   */
  protected getClient(): T {
    if (!this.client) {
      throw new Error('Telegram client not initialized')
    }
    return this.client
  }
}

/**
 * Command registry
 */
class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  /**
   * Register a command
   */
  register(command: Command) {
    this.commands.set(command.meta.name, command)
  }

  /**
   * Get a command by name
   */
  get(name: string): Command | undefined {
    return this.commands.get(name)
  }

  /**
   * Get all registered commands
   */
  getAll(): Command[] {
    return Array.from(this.commands.values())
  }
}

// Export singleton instance
export const registry = new CommandRegistry()
