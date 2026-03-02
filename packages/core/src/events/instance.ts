import { defineEventa } from '@moeru/eventa'

/** Core cleanup request — signals all services to release resources */
export const coreCleanupEvent = defineEventa<void>('core:cleanup')

/** Error notification — broadcast to all connected clients */
export const coreErrorEvent = defineEventa<{ error: string, description?: string }>('core:error')
