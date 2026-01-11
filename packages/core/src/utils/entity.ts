import type { Result } from '@unbird/result'
import type { Entity } from 'telegram/define'

import type { CoreEntity } from '../types/events'

import { Err, Ok } from '@unbird/result'
import { Api } from 'telegram'

export function resolveEntity(entity: Entity): Result<CoreEntity> {
  if (entity instanceof Api.User) {
    return Ok({
      type: 'user',
      id: entity.id.toString(),
      name: [entity.firstName, entity.lastName].filter(Boolean).join(' ').trim(),
      username: entity.username ?? entity.id.toString(),
      accessHash: entity.accessHash?.toString(),
    })
  }

  if (entity instanceof Api.Chat) {
    return Ok({
      type: 'chat',
      id: entity.id.toString(),
      name: entity.title,
    })
  }

  if (entity instanceof Api.Channel) {
    return Ok({
      type: 'channel',
      id: entity.id.toString(),
      name: entity.title,
      accessHash: entity.accessHash?.toString(),
    })
  }

  return Err(new Error('Unknown entity type'))
}
