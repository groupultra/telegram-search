import { initLogger, LoggerFormat, LoggerLevel } from '@guiiai/logg'

initLogger(LoggerLevel.Debug, LoggerFormat.Pretty)

function createStorageMock() {
  const storage = new Map<string, string>()

  return {
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    setItem(key: string, value: string) {
      storage.set(key, String(value))
    },
    removeItem(key: string) {
      storage.delete(key)
    },
    clear() {
      storage.clear()
    },
    key(index: number) {
      return [...storage.keys()][index] ?? null
    },
    get length() {
      return storage.size
    },
  }
}

const storageMock = createStorageMock()

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: storageMock,
})

Object.defineProperty(globalThis, 'sessionStorage', {
  configurable: true,
  value: createStorageMock(),
})

if ('self' in globalThis) {
  Object.defineProperty(globalThis.self, 'localStorage', {
    configurable: true,
    value: storageMock,
  })
}
