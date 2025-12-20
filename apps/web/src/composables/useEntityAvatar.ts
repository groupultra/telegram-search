import type { ComputedRef } from 'vue'

import { useAvatarStore, useBridgeStore } from '@tg-search/client'
import { computed, onMounted, watch } from 'vue'

import { ensureUserAvatarImmediate, useEnsureChatAvatar, useEnsureUserAvatar } from './useEnsureAvatar'

interface Props {
  entity: 'self' | 'other'
  id: string | number
  entityType?: 'chat' | 'user'
  fileId?: string | number
  name?: string
  size?: 'sm' | 'md' | 'lg'
  ensureOnMount?: boolean
  forceRefresh?: boolean
}

export function useEntityAvatar(props: Readonly<Props>): { src: ComputedRef<string | undefined> } {
  const avatarStore = useAvatarStore()
  const bridgeStore = useBridgeStore()

  const idRef = computed(() => props.id)
  const fileIdRef = computed(() => props.fileId)

  const isSelf = props.entity === 'self'
  const isChat = props.entityType === 'chat'
  const expectedFileId = computed(() => {
    const v = props.fileId
    return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined
  })

  if (props.ensureOnMount) {
    if (isSelf) {
      const trigger = () => {
        const connected = bridgeStore.activeSession?.isReady
        if (!connected)
          return
        const current = avatarStore.getUserAvatarFileId(props.id)
        const expected = expectedFileId.value
        if (expected && current !== expected)
          avatarStore.ensureUserAvatar(String(props.id), expected, props.forceRefresh)
        else
          void ensureUserAvatarImmediate(props.id)
      }
      onMounted(trigger)
      watch(() => bridgeStore.activeSession?.isReady, (c) => {
        if (c)
          trigger()
      })
      watch(() => props.id, trigger)
    }
    else {
      isChat ? useEnsureChatAvatar(idRef, fileIdRef.value) : useEnsureUserAvatar(idRef)
    }
  }

  const src = computed(() => {
    const isUser = isSelf || props.entityType === 'user'
    return isUser ? avatarStore.getUserAvatarUrl(props.id) : avatarStore.getChatAvatarUrl(props.id)
  })

  return { src }
}
