import type { EventContext } from '@moeru/eventa'

import type { TelegramApplication } from '../application/runtime'

import { defineInvokeHandler, defineStreamInvokeHandler } from '@moeru/eventa'
import { authContracts, loginInputSchema, submitChallengeInputSchema } from '@tg-search/protocol'
import { safeParse } from 'valibot'

import { invalidArgument } from '../application/errors'

export function registerAuthHandlers(context: EventContext<any, any>, application: TelegramApplication) {
  defineStreamInvokeHandler(context, authContracts.login, async function* (input, options) {
    const parsed = safeParse(loginInputSchema, input)
    if (!parsed.success) {
      yield { type: 'failed', flowId: '', error: invalidArgument('Invalid login input').error }
      return
    }
    yield* application.login(parsed.output, options?.abortController?.signal)
  })

  return defineInvokeHandler(context, authContracts.submitChallenge, (input) => {
    const parsed = safeParse(submitChallengeInputSchema, input)
    return parsed.success
      ? application.submitAuthChallenge(parsed.output)
      : invalidArgument('Invalid authentication challenge')
  })
}
