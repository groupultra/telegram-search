import type { Result } from '@unbird/result'

import { Err, Ok } from '@unbird/result'

export type PromiseResult<T> = Promise<Result<T>>

export async function withResult<T>(fn: () => Promise<T>): PromiseResult<T> {
  try {
    return Ok(await fn())
  }
  catch (error) {
    if (error instanceof Error && error.cause) {
      return Err(error.cause)
    }

    return Err(error)
  }
}
