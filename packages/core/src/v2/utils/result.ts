// TODO: Monad?

export interface Result<T> {
  data: T | null
  error: unknown | Error | null
}

export type PromiseResult<T> = Promise<Result<T>>
export type PromiseVoid = Promise<Result<void>>

export function withResult<T>(data: T | null, error: unknown | Error | null): Result<T> {
  return {
    data,
    error,
  }
}
