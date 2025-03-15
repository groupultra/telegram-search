import type { ClientProxyConfig } from '@tg-search/common'
import type { DatabaseFolder, DatabaseNewChat } from '@tg-search/db'
import type { Api } from 'telegram'
import type { TelegramChatsResult } from './chat'
import type { TelegramFolder } from './folder'
import type { GetTelegramMessageParams, TelegramMessage } from './message'

export interface ConnectOptions {
  code?: () => Promise<string>
  password?: () => Promise<string>
}

export interface ClientAdapterConfig {
  apiId: number
  apiHash: string
  phoneNumber: string
  password?: string
  systemVersion?: string
  proxy?: ClientProxyConfig
}

/**
 * Telegram adapter type
 */
export type TelegramAdapterType = 'bot' | 'client'

/**
 * Combined Telegram adapter type
 */
export type TelegramAdapter = ITelegramBotAdapter | ITelegramClientAdapter

/**
 * Base Telegram adapter interface with common functionality
 */
export interface BaseTelegramAdapter {
  /**
   * Get adapter type
   */
  readonly type: TelegramAdapterType

  /**
   * Connect to Telegram
   */
  connect: (options?: ConnectOptions) => Promise<void>

  /**
   * Disconnect from Telegram
   */
  disconnect: () => Promise<void>

  /**
   * Listen for new messages
   */
  onMessage: (callback: (message: TelegramMessage) => Promise<void>) => void
}

/**
 * Bot adapter interface with bot-specific functionality
 */
export interface ITelegramBotAdapter extends BaseTelegramAdapter {
  type: 'bot'
}

/**
 * Client adapter interface with client-specific functionality
 */
export interface ITelegramClientAdapter extends BaseTelegramAdapter {
  type: 'client'

  /**
   * Check if the client is connected
   */
  isConnected: () => Promise<boolean>

  /**
   * Get me info
   */
  getMeInfo: () => Promise<Api.User>

  /**
   * Get user info
   */
  getUserInfo: (userId: string) => Promise<Api.User>

  /**
   * Get users info
   */
  getUsersInfo: (userIds: string[]) => Promise<Api.User[]>

  /**
   * Send verification code
   */
  sendCode: () => Promise<boolean>

  /**
   * Logout
   */
  logout: () => Promise<void>

  /**
   * Get messages from chat
   */
  getMessages: (chatId: number, limit?: number, options?: GetTelegramMessageParams) => AsyncGenerator<TelegramMessage>

  /**
   * Get all dialogs (chats) with pagination
   */
  getPaginationDialogs: (offset?: number, limit?: number) => Promise<TelegramChatsResult>

  /**
   * Get all folders from Telegram
   */
  getFolders: () => Promise<DatabaseFolder[]>

  /**
   * Get all chats from Telegram
   */
  getDialogs: () => Promise<DatabaseNewChat[]>

  /**
   * Get folders for a specific chat
   */
  getFoldersForChat: (chatId: number) => Promise<TelegramFolder[]>

  /**
   * Get history for a specific chat
   */
  getHistory: (chatId: number) => Promise<Api.messages.TypeMessages & { count: number }>
}

export interface EmbeddingModelConfig {
  provider: 'openai' | 'ollama'
  model: string
  apiKey?: string
  apiBase?: string
}

export interface IEmbeddingModel {

  getTokenCount: (text: string) => number
  getTotalTokens: (texts: string[]) => number
  calculateCost: (tokens: number) => number
  getUsage: () => { tokens: number, cost: number }
  generateEmbedding: (text: string) => Promise<number[]>
  generateEmbeddings: (texts: string[]) => Promise<number[][]>
  destroy: () => void
}
