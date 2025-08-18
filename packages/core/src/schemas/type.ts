/* eslint-disable unicorn/prefer-node-protocol */
import type { Buffer } from 'buffer'

import { customType } from 'drizzle-orm/pg-core'

export const bytea = customType<{
  data: Buffer
  default: false
}>({
  dataType() {
    return 'bytea'
  },
})
