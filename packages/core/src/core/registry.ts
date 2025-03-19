interface Resolver<T> {
  run: (opts: T) => Promise<void>
}

export function useResolverRegistry() {
  const registry = new Map<string, Resolver<any>>()

  return {
    register: <T>(name: string, resolver: Resolver<T>) => {
      registry.set(name, resolver)
    },
    get: <T>(name: string) => {
      return registry.get(name) as Resolver<T>
    },
  }
}
