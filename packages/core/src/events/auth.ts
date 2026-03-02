import { defineEventa } from '@moeru/eventa'

// ============================================================================
// Auth commands (client → core)
// ============================================================================

export const authLoginEvent = defineEventa<{ phoneNumber?: string, session?: string }>('auth:login')
export const authLogoutEvent = defineEventa<void>('auth:logout')
export const authCodeEvent = defineEventa<{ code: string }>('auth:code')
export const authPasswordEvent = defineEventa<{ password: string }>('auth:password')

// ============================================================================
// Auth notifications (core → client)
// ============================================================================

export const authCodeNeededEvent = defineEventa<void>('auth:code:needed')
export const authPasswordNeededEvent = defineEventa<void>('auth:password:needed')
export const authConnectedEvent = defineEventa<void>('auth:connected')
export const authDisconnectedEvent = defineEventa<void>('auth:disconnected')
export const authErrorEvent = defineEventa<void>('auth:error')
