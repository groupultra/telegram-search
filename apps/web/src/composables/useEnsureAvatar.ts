import type { ComputedRef, Ref } from 'vue'

import { prefillChatAvatarIntoStore, prefillUserAvatarIntoStore, useAvatarStore, useBridgeStore } from '@tg-search/client'
import { onMounted, unref, watch } from 'vue'

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>
type ID = string | number

/**
 * Ensure a user's avatar is available when the component mounts.
 * Behavior:
 * - Prefills from IndexedDB cache first.
 * - If still missing, triggers network fetch via centralized avatar store.
 * - Re-runs when `userId` changes.
 */
async function ensureCore(
  idRaw: ID,
  opts: {
    hasValid: (id: string, expectedFileId?: string) => boolean
    inflightPrefillIds?: Set<string>
    prefill: (id: string) => Promise<boolean>
    getFileId: (id: ID) => string | undefined
    primeCache: (id: string, fileId: string) => void
    ensureFetch: (id: string, expectedFileId?: string) => void
    expectedFileId?: string
  },
): Promise<void> {
  const id = idRaw
  if (!id)
    return
  const key = String(id)
  if (opts.hasValid(key, opts.expectedFileId))
    return
  if (opts.inflightPrefillIds && opts.inflightPrefillIds.has(key))
    return
  if (opts.inflightPrefillIds)
    opts.inflightPrefillIds.add(key)
  try {
    const prefillSuccess = await opts.prefill(key)
    const fileId = opts.getFileId(id)
    if (prefillSuccess && fileId)
      opts.primeCache(key, fileId)
    if (opts.hasValid(key, opts.expectedFileId))
      return
  }
  catch (error) {
    console.warn('[useEnsureAvatar] Prefill avatar failed', error)
  }
  finally {
    if (opts.inflightPrefillIds)
      opts.inflightPrefillIds.delete(key)
  }
  if (!opts.hasValid(key, opts.expectedFileId))
    opts.ensureFetch(String(id), opts.expectedFileId)
}

/**
 * Generic core to ensure avatar availability for an entity.
 * Supports `user` and `chat` kinds, prefilling cache first, then fetching.
 */
interface AvatarStrategy {
  hasValid: (id: string, expectedFileId?: string) => boolean
  inflightPrefillIds?: Set<string>
  prefill: (id: string) => Promise<boolean>
  getFileId: (id: ID) => string | undefined
  primeCache: (id: string, fileId: string) => void
  ensureFetch: (id: string, expectedFileId?: string) => void
}
async function ensureAvatarCore(
  kind: 'user' | 'chat',
  idRaw: ID,
  fileIdRaw?: ID,
): Promise<void> {
  const avatarStore = useAvatarStore()
  const bridgeStore = useBridgeStore()
  const expected = fileIdRaw != null ? String(fileIdRaw) : undefined
  const strategies: Record<'user' | 'chat', AvatarStrategy> = {
    user: {
      hasValid: (id: string, _exp?: string) => avatarStore.hasValidUserAvatar(id),
      inflightPrefillIds: avatarStore.inflightUserPrefillIds,
      prefill: (id: string) => prefillUserAvatarIntoStore(id),
      getFileId: (id: ID) => avatarStore.getUserAvatarFileId(id),
      primeCache: (id: string, fileId: string) => bridgeStore.sendEvent('entity:avatar:prime-cache', { userId: id, fileId }),
      ensureFetch: (id: string, exp?: string) => avatarStore.ensureUserAvatar(id, exp),
    },
    chat: {
      hasValid: (id: string, exp?: string) => avatarStore.hasValidChatAvatar(id, exp),
      prefill: (id: string) => prefillChatAvatarIntoStore(id),
      getFileId: (id: ID) => avatarStore.getChatAvatarFileId(id),
      primeCache: (id: string, fileId: string) => bridgeStore.sendEvent('entity:chat-avatar:prime-cache', { chatId: id, fileId }),
      ensureFetch: (id: string, exp?: string) => avatarStore.ensureChatAvatar(id, exp),
    },
  }
  const s = strategies[kind]
  await ensureCore(idRaw, {
    hasValid: s.hasValid,
    inflightPrefillIds: s.inflightPrefillIds,
    prefill: s.prefill,
    getFileId: s.getFileId,
    primeCache: s.primeCache,
    ensureFetch: s.ensureFetch,
    expectedFileId: expected,
  })
}

async function ensureUserAvatarCore(userIdRaw: ID): Promise<void> {
  await ensureAvatarCore('user', userIdRaw)
}

export function useEnsureUserAvatar(userId: MaybeRef<ID>): void {
  async function ensure() {
    await ensureUserAvatarCore(unref(userId))
  }
  onMounted(ensure)
  watch(() => unref(userId), ensure)
}

async function ensureChatAvatarCore(chatIdRaw: ID, fileIdRaw?: ID): Promise<void> {
  await ensureAvatarCore('chat', chatIdRaw, fileIdRaw)
}

export function useEnsureChatAvatar(chatId: MaybeRef<ID>, fileId?: MaybeRef<ID>): void {
  async function ensure() {
    await ensureChatAvatarCore(unref(chatId), unref(fileId))
  }
  onMounted(ensure)
  watch([() => unref(chatId), () => unref(fileId)], ensure)
}

/**
 * Ensure a user's avatar immediately without lifecycle hooks.
 * Use when you need to trigger avatar availability from watchers or events.
 */
export async function ensureUserAvatarImmediate(userId: ID): Promise<void> {
  await ensureUserAvatarCore(userId)
}

/**
 * Ensure a chat's avatar immediately without lifecycle hooks.
 * Safe to call outside of setup() contexts.
 */
export async function ensureChatAvatarImmediate(chatId: ID, fileId?: ID): Promise<void> {
  await ensureChatAvatarCore(chatId, fileId)
}
