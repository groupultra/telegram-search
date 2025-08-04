import type { CoreContext } from '../context'
import type { DialogService } from '../services'

import { useLogger } from '@unbird/logg'

export function registerDialogEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:dialog:event')

  return (dialogService: DialogService) => {
    emitter.on('dialog:fetch', async () => {
      logger.verbose('Fetching dialogs')

      const dialogs = (await dialogService.fetchDialogs()).expect('Failed to fetch dialogs')

      emitter.emit('storage:record:dialogs', { dialogs })
    })
  }
}
