import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'
import { Api } from 'telegram'

import { withResult } from '../utils/result'

export interface DialogEvent {
  'dialog:fetch': () => void

  'dialog:list': (data: { dialogs: Api.TypeDialog[] }) => void
}

export function createDialogService(ctx: CoreContext) {
  const { getClient, emitter, withError } = ctx

  const logger = useLogger()

  async function fetchDialogs(): PromiseResult<Api.messages.Dialogs | null> {
    // Total list has a total property
    const client = getClient()
    if (!client) {
      return withResult(null, withError('Client not set'))
    }

    const dialogs = await client.invoke(new Api.messages.GetDialogs({})) as Api.messages.Dialogs
    logger.withFields({ count: dialogs.dialogs.length }).debug('Fetched dialogs')

    emitter.emit('dialog:list', { dialogs: dialogs.dialogs })

    return withResult(dialogs, null)
  }

  return {
    fetchDialogs,
  }
}
