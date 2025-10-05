/// <reference types="vite/client" />

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    scope?: string
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: Error) => void
  }

  export interface RegisterSWReturn {
    update: () => Promise<void>
    getRegistration: () => Promise<ServiceWorkerRegistration | undefined>
  }

  export function registerSW(options?: RegisterSWOptions): RegisterSWReturn
}
