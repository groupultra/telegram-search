import { useLogger } from '@tg-search/common'

export interface Resolver<T> {
  run: (opts: T) => Promise<void>
}

export function useResolverRegistry() {
  const logger = useLogger()

  const registry = new Map<string, Resolver<any>>()

  return {
    register: <T>(name: string, resolver: Resolver<T>) => {
      logger.withFields({ name }).debug('Register resolver')
      registry.set(name, resolver)
    },

    get: <T>(name: string) => {
      return registry.get(name) as Resolver<T>
    },
  }
}
