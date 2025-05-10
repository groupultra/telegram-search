import type { Dialog } from 'telegram/tl/custom/dialog'
import type { CoreContext } from '../context'
import type { Result } from '../utils/monad'

import { circularObject, useLogger } from '@tg-search/common'

import { Err, Ok } from '../utils/monad'

export type DialogType = 'user' | 'group' | 'channel'

export interface CoreDialog {
  id: number
  name: string
  type: DialogType
  unreadCount?: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: Date
}

export interface DialogEventToCore {
  'dialog:fetch': () => void
}

export interface DialogEventFromCore {
  'dialog:data': (data: { dialogs: CoreDialog[] }) => void
}

export type DialogEvent = DialogEventFromCore & DialogEventToCore

export type DialogService = ReturnType<typeof createDialogService>

export function createDialogService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  const logger = useLogger('core:dialog')

  function resolveDialog(dialog: Dialog): Result<{
    id: number
    name: string
    type: DialogType
  }> {
    const { isGroup, isChannel, isUser } = dialog
    let type: DialogType
    if (isGroup) {
      type = 'group'
    }
    else if (isChannel) {
      type = 'channel'
    }
    else if (isUser) {
      type = 'user'
    }
    else {
      logger.withFields({ dialog: circularObject(dialog) }).warn('Unknown dialog')
      return Err('Unknown dialog')
    }

    const id = dialog.entity?.id
    if (!id) {
      logger.withFields({ dialog: circularObject(dialog) }).warn('Unknown dialog with no id')
      return Err('Unknown dialog with no id')
    }

    let { name } = dialog
    if (!name) {
      name = id.toString()
    }

    return Ok({
      id: id.toJSNumber(),
      name,
      type,
    })
  }

  async function fetchDialogs(): Promise<Result<CoreDialog[]>> {
    // TODO: use invoke api
    // TODO: use pagination
    // Total list has a total property
    const dialogList = await getClient().getDialogs()
    // const dialogs = await getClient().invoke(new Api.messages.GetDialogs({})) as Api.messages.Dialogs

    const dialogs: CoreDialog[] = []
    for (const dialog of dialogList) {
      if (!dialog.entity) {
        continue
      }

      const result = resolveDialog(dialog).orUndefined()
      if (!result) {
        continue
      }

      let messageCount = 0
      let lastMessage: string | undefined
      let lastMessageDate: Date | undefined
      const unreadCount = dialog.unreadCount

      if ('participantsCount' in dialog.entity) {
        messageCount = dialog.entity.participantsCount || 0
      }

      if (dialog.message) {
        lastMessage = dialog.message.message
        lastMessageDate = new Date(dialog.message.date * 1000)
      }

      dialogs.push({
        id: result.id,
        name: result.name,
        type: result.type,
        unreadCount,
        messageCount,
        lastMessage,
        lastMessageDate,
      })
    }

    useLogger().withFields({ count: dialogs.length }).verbose('Fetched dialogs')

    emitter.emit('dialog:data', { dialogs })

    return Ok(dialogs)
  }

  return {
    fetchDialogs,
  }
}
