import type { CoreUserEntity } from '../types/events'

import { defineEventa } from '@moeru/eventa'

/** Session string updated — client should persist */
export const sessionUpdateEvent = defineEventa<{ session: string }>('session:update')

/** Account is fully initialized and ready */
export const accountReadyEvent = defineEventa<{ accountId: string }>('account:ready')

/** Current user entity data */
export const entityMeDataEvent = defineEventa<CoreUserEntity>('entity:me:data')
