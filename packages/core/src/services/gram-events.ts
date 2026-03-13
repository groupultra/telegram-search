import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'

import { Api } from 'telegram'
import { DeletedMessage, DeletedMessageEvent } from 'telegram/events/DeletedMessage'
import { EditedMessage, EditedMessageEvent } from 'telegram/events/EditedMessage'
import { NewMessage, NewMessageEvent } from 'telegram/events/NewMessage'

import { CoreEventType } from '../types/events'

export type GramEventsService = ReturnType<typeof createGramEventsService>

function hasPts(update: unknown): update is { pts: number } {
  return typeof update === 'object'
    && update !== null
    && 'pts' in update
    && typeof (update as { pts?: unknown }).pts === 'number'
}

export function createGramEventsService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:gram-events')

  // Store event handler reference and event type for cleanup
  let eventHandler: ((event: NewMessageEvent | EditedMessageEvent | DeletedMessageEvent) => Promise<void>) | undefined
  let eventTypes: Array<NewMessage | EditedMessage | DeletedMessage> = []

  function getPeerChannelId(eventPeer: unknown): string | undefined {
    if (eventPeer instanceof Api.PeerChannel)
      return eventPeer.channelId.toJSNumber().toString()
    if (eventPeer instanceof Api.PeerUser)
      return eventPeer.userId.toJSNumber().toString()
    if (eventPeer instanceof Api.PeerChat)
      return eventPeer.chatId.toJSNumber().toString()
    return undefined
  }

  function getPtsAndChannel(message: Api.Message, originalUpdate: unknown): { pts?: number, date?: number, isChannel: boolean } {
    let pts: number | undefined
    let isChannel = false

    if (originalUpdate instanceof Api.UpdateNewChannelMessage || originalUpdate instanceof Api.UpdateEditChannelMessage) {
      pts = originalUpdate.pts
      isChannel = true
    }
    else if (originalUpdate instanceof Api.UpdateNewMessage || originalUpdate instanceof Api.UpdateEditMessage) {
      pts = originalUpdate.pts
    }
    else if (hasPts(originalUpdate)) {
      pts = originalUpdate.pts
      isChannel = message.peerId instanceof Api.PeerChannel
    }

    return {
      pts,
      date: message.date,
      isChannel,
    }
  }

  function getDeletedMessageEventChannel(eventPeer: unknown): { pts?: number, isChannel: boolean } {
    return {
      pts: undefined,
      isChannel: eventPeer instanceof Api.PeerChannel,
    }
  }

  function registerGramEvents() {
    // Prevent duplicate registration
    if (eventHandler) {
      logger.debug('Telegram event handler already registered')
      return
    }

    eventHandler = async (event) => {
      if (event instanceof NewMessageEvent) {
        const originalUpdate = event.originalUpdate
        const { isChannel, pts, date } = getPtsAndChannel(event.message, originalUpdate)
        ctx.emitter.emit(CoreEventType.GramMessageReceived, {
          message: event.message,
          pts,
          date,
          isChannel,
        })
      }
      else if (event instanceof EditedMessageEvent) {
        const originalUpdate = event.originalUpdate
        const { isChannel, pts, date } = getPtsAndChannel(event.message, originalUpdate)
        ctx.emitter.emit(CoreEventType.GramMessageEdited, {
          message: event.message,
          pts,
          date,
          isChannel,
        })
      }
      else if (event instanceof DeletedMessageEvent) {
        const chatId = getPeerChannelId(event.peer)
        const { pts, isChannel } = getDeletedMessageEventChannel(event.peer)
        ctx.emitter.emit(CoreEventType.GramMessageDeleted, {
          messageIds: event.deletedIds.map(id => id.toString()),
          chatId,
          pts,
          isChannel,
        })
      }
    }

    eventTypes = [new NewMessage({}), new EditedMessage({}), new DeletedMessage({})]
    for (const eventType of eventTypes)
      ctx.getClient().addEventHandler(eventHandler, eventType)

    logger.debug('Registered Telegram event handler')
  }

  function cleanup() {
    if (eventHandler && eventTypes.length > 0) {
      try {
        const client = ctx.getClient()
        if (client) {
          for (const eventType of eventTypes)
            client.removeEventHandler(eventHandler, eventType)
          logger.debug('Removed Telegram event handler')
        }
      }
      catch (error) {
        logger.withError(error).warn('Failed to remove Telegram event handler')
      }
      eventHandler = undefined
      eventTypes = []
    }
  }

  // Listen for cleanup event
  ctx.emitter.once(CoreEventType.CoreCleanup, cleanup)

  return {
    registerGramEvents,
    cleanup,
  }
}
