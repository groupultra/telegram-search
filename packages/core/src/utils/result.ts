// TODO: Monad?
// TODO: Error handling?

export interface Result<T> {
  data: T
  error: unknown | Error | null
}

export type PromiseResult<T> = Promise<Result<T>>
export type PromiseVoid = Promise<Result<void>>

export function withResult<T>(data: T, error: unknown | Error | null): Result<T> {
  return {
    data,
    error,
  }
}
