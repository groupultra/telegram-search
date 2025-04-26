import type { CoreConfig } from '../types/config'

import os from 'node:os'
import { join } from 'node:path'
import { safeParse } from 'valibot'

import { coreConfigSchema } from '../types/config'
/**
 * Default configuration with detailed comments
 */
export function generateDefaultConfig(): CoreConfig {
  const homeDir = os.homedir()
  const storageDir = join(homeDir, '.telegram-search')

  const defaultConfig = safeParse(coreConfigSchema, {
    path: {
      storage: storageDir,
    },
  })

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config')
  }

  return defaultConfig.output
}
