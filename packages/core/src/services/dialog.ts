import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'

import { getEntityInfo } from '../utils/entity'
import { withResult } from '../utils/result'

export interface CoreDialog {
  id: number
  name: string
  type: 'user' | 'group' | 'channel'
  unreadCount: number
  messageCount?: number
  lastMessage?: string
  lastMessageDate?: Date
}

export interface DialogEventToCore {
  'dialog:fetch': () => void
}

export interface DialogEventFromCore {
  'dialog:list': (data: { dialogs: CoreDialog[] }) => void
}

export type DialogEvent = DialogEventFromCore & DialogEventToCore

export function createDialogService(ctx: CoreContext) {
  const { getClient, emitter } = ctx

  async function fetchDialogs(): PromiseResult<CoreDialog[] | null> {
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

      const { id, type, name } = getEntityInfo(dialog.entity)

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
        id,
        name,
        type,
        unreadCount,
        messageCount,
        lastMessage,
        lastMessageDate,
      })
    }

    useLogger().withFields({ count: dialogs.length }).debug('Fetched dialogs')

    emitter.emit('dialog:list', { dialogs })

    return withResult(dialogs, null)
  }

  return {
    fetchDialogs,
  }
}
