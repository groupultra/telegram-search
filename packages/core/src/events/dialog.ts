import type { CoreChatFolder, CoreDialog } from '../types/dialog'

import { defineEventa, defineInvokeEventa } from '@moeru/eventa'

// ============================================================================
// Dialog RPC
// ============================================================================

/** Fetch all dialogs from Telegram (RPC) */
export const dialogFetchInvoke = defineInvokeEventa<
  { dialogs: CoreDialog[] },
  void
>('dialog:fetch')

/** Fetch chat folders from Telegram (RPC) */
export const dialogFoldersFetchInvoke = defineInvokeEventa<
  { folders: CoreChatFolder[] },
  void
>('dialog:folders:fetch')

// ============================================================================
// Dialog commands (fire-and-forget)
// ============================================================================

/** Request fetching a single dialog's avatar */
export const dialogAvatarFetchEvent = defineEventa<{ chatId: number | string }>('dialog:avatar:fetch')

/** Set or get a dialog note */
export const dialogNoteEvent = defineEventa<{ chatId: string, note: string, modify: boolean }>('dialog:note')

// ============================================================================
// Dialog notifications (core → client)
// ============================================================================

/** Avatar data for a single dialog */
export const dialogAvatarDataEvent = defineEventa<{
  chatId: number
  byte: Uint8Array | { data: number[] }
  mimeType: string
  fileId?: string
}>('dialog:avatar:data')
