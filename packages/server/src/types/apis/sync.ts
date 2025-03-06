/**
 * Sync params
 */
export interface SyncParams {
  [key: string]: unknown
}

/**
 * Sync command details
 */
export interface SyncDetails {
  totalChats?: number
  totalFolders?: number
  processedChats?: number
  processedFolders?: number
}

/**
 * Multi sync options
 */
export interface MultiSyncOptions {
  chatIds: number[]
  type?: 'metadata' | 'messages'
  priorities?: Record<number, number>
  options?: Record<number, Record<string, any>>

  [key: string]: unknown
}
