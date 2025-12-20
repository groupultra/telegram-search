import type { Logger } from '@guiiai/logg'

import type { CoreContext } from '../context'
import type { AccountModels } from '../models/accounts'
import type { AccountService } from '../services/account'

export function registerAccountEventHandlers(ctx: CoreContext, logger: Logger, accountModels: AccountModels) {
  logger = logger.withContext('core:account:event')

  return (accountService: AccountService) => {
    let hasBootstrappedDialogs = false

    ctx.emitter.on('account:setup', async () => {
      logger.verbose('Getting me info')
      const account = (await accountService.fetchMyAccount()).expect('Failed to get me info')

      // Record account and set current account ID
      logger.withFields({ userId: account.id }).verbose('Recording account for current user')

      const dbAccount = await accountModels.recordAccount(ctx.getDB(), 'telegram', account.id)
      ctx.setCurrentAccountId(dbAccount.id)
      ctx.setMyUser(account)

      logger.withFields({ accountId: dbAccount.id }).verbose('Set current account ID')

      ctx.emitter.emit('account:ready', { accountId: dbAccount.id })

      // Bootstrap dialogs once the account context is established. This
      // ensures that any dialog/storage handlers relying on currentAccountId
      // see a consistent state.
      if (!hasBootstrappedDialogs) {
        hasBootstrappedDialogs = true
        ctx.emitter.emit('dialog:fetch')
      }
    })
  }
}
