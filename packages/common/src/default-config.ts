import type { Config } from './config-schema'

import { safeParse } from 'valibot'

import { configSchema } from './config-schema'

export function generateDefaultConfig(): Config {
  const defaultConfig = safeParse(configSchema, {})

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config', { cause: defaultConfig.issues })
  }

  return defaultConfig.output
}
