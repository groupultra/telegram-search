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
