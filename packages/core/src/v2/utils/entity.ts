import type { Entity } from 'telegram/define'

import { Api } from 'telegram'

/**
 * Pure functions for resolving Telegram entity information
 */

type EntityType = 'user' | 'group' | 'channel'
type ChatType = EntityType | 'saved'
interface EntityInfo { id: number, type: EntityType, name: string }

/**
 * Get entity type and name from a Telegram entity
 */
export function getEntityInfo(entity: Entity): EntityInfo {
  if (entity instanceof Api.User) {
    return {
      id: entity.id.toJSNumber(),
      type: getChatType(entity) as EntityType,
      name: [entity.firstName, entity.lastName].filter(Boolean).join(' ')
        || entity.username
        || 'Unknown User',
    }
  }

  if (entity instanceof Api.Chat || entity instanceof Api.Channel) {
    return {
      id: entity.id.toJSNumber(),
      type: getChatType(entity) as EntityType,
      name: entity.title,
    }
  }

  return { id: 0, type: 'user', name: 'Unknown' }
}

/**
 * Get chat type from Telegram chat object
 */
export function getChatType(chat: Entity): ChatType {
  const typeMap: Record<string, (chat: Entity) => ChatType> = {
    Channel: c => c instanceof Api.Channel && c.megagroup ? 'group' : 'channel',
    Chat: () => 'group',
    User: c => 'self' in c && c.self ? 'saved' : 'user',
  }

  return typeMap[chat.className]?.(chat) ?? 'group'
}

/**
 * Get peer ID from a Telegram peer object
 */
export function getPeerId(peer: Api.TypePeer): number {
  const peerMap: Record<string, (p: Api.TypePeer) => number> = {
    [Api.PeerUser.name]: p => 'userId' in p ? p.userId.toJSNumber() : 0,
    [Api.PeerChat.name]: p => 'chatId' in p ? p.chatId.toJSNumber() : 0,
    [Api.PeerChannel.name]: p => 'channelId' in p ? p.channelId.toJSNumber() : 0,
  }

  const peerType = peer.constructor.name
  return peerMap[peerType]?.(peer) ?? 0
}
