import type { Logger } from '@guiiai/logg'
import type { Result } from '@unbird/result'

import type { CoreContext } from '../context'
import type { CoreUserEntity } from '../types/events'

import { withSpan } from '@tg-search/observability'
import { Ok } from '@unbird/result'

import { resolveEntity } from '../utils/entity'

export type AccountService = ReturnType<typeof createAccountService>

export function createAccountService(ctx: CoreContext, logger: Logger) {
  logger = logger.withContext('core:account:service')

  async function fetchMyAccount(): Promise<Result<CoreUserEntity>> {
    return withSpan('core:account:service:fetchMyAccount', async () => {
      logger.verbose('Fetching my account')

      const apiUser = await ctx.getClient().getMe()
      const result = resolveEntity(apiUser).expect('Failed to resolve entity') as CoreUserEntity
      ctx.emitter.emit('entity:me:data', result)
      return Ok(result)
    })
  }

  return {
    fetchMyAccount,
  }
}
