import type { CoreContext } from '../context'
import type { DialogService } from '../services'

import { useLogger } from '@guiiai/logg'

export function registerDialogEventHandlers(ctx: CoreContext) {
  const { emitter } = ctx
  const logger = useLogger('core:dialog:event')

  return (dialogService: DialogService) => {
    emitter.on('dialog:fetch', async () => {
      logger.verbose('Fetching dialogs')

      const dialogs = (await dialogService.fetchDialogs()).expect('Failed to fetch dialogs')

      // Get current account ID from context
      const accountId = ctx.getCurrentAccountId()

      emitter.emit('storage:record:dialogs', { dialogs, accountId })
    })

    // Prioritized single-avatar fetch for viewport-visible items
    emitter.on('dialog:avatar:fetch', async ({ chatId }) => {
      logger.withFields({ chatId }).verbose('Fetching single dialog avatar')
      await dialogService.fetchSingleDialogAvatar(String(chatId))
    })
  }
}
