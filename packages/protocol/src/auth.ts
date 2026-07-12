import type { InferOutput } from 'valibot'

import type { AppError, AppResult } from './errors'

import { defineInvokeEventa } from '@moeru/eventa'
import { minLength, object, picklist, pipe, string } from 'valibot'

export const loginInputSchema = object({
  phoneNumber: pipe(string(), minLength(1)),
})

export const submitChallengeInputSchema = object({
  flowId: pipe(string(), minLength(1)),
  challenge: picklist(['code', 'password']),
  value: pipe(string(), minLength(1)),
})

export type LoginInput = InferOutput<typeof loginInputSchema>
export type SubmitChallengeInput = InferOutput<typeof submitChallengeInputSchema>

export type AuthUpdate
  = | { type: 'started', flowId: string }
    | { type: 'challenge', flowId: string, challenge: 'code' | 'password' }
    | { type: 'completed', flowId: string, session: string }
    | { type: 'failed', flowId: string, error: AppError }

export const authContracts = {
  login: defineInvokeEventa<AuthUpdate, LoginInput>('tg.v1.auth.login'),
  submitChallenge: defineInvokeEventa<AppResult<{ accepted: true }>, SubmitChallengeInput>('tg.v1.auth.challenge.submit'),
}
