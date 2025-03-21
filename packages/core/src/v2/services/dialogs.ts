import type { Api } from 'telegram'
import type { CoreContext } from '../context'
import type { PromiseResult } from '../utils/result'

import { useLogger } from '@tg-search/common'

import { withResult } from '../utils/result'

export interface DialogEvent {
  'dialog:fetch': () => void

  'dialog:list': (data: { dialogs: Api.TypeDialog[] }) => void
}

export function createDialogService(ctx: CoreContext) {
  const { getClient, emitter, withError } = ctx

  const logger = useLogger()

  async function fetchDialogs(): PromiseResult<Api.TypeDialog[] | null> {
    // Total list has a total property
    const client = getClient()
    if (!client) {
      return withResult(null, withError('Client not set'))
    }

    // TODO: use invoke api
    // const dialogs = await client.invoke(new Api.messages.GetDialogs({})) as Api.messages.Dialogs
    const dialogs = await client.getDialogs() as unknown as Api.TypeDialog[]
    logger.withFields({ count: dialogs.length }).debug('Fetched dialogs')

    emitter.emit('dialog:list', { dialogs })

    return withResult(dialogs, null)
  }

  return {
    fetchDialogs,
  }
}
