import type { Config } from './config-schema'

import path from 'path-browserify-esm'
import { safeParse } from 'valibot'

import { configSchema } from './config-schema'

export function generateDefaultConfig(paths?: { storagePath?: string, assetsPath?: string }): Config {
  const defaultConfig = safeParse(configSchema, {
    path: {
      storage: paths?.storagePath ?? '~/.telegram-search',
      assets: paths?.assetsPath ?? '',
      dict: path.join(paths?.assetsPath ?? '', 'dict.txt.big'),
    },
  })

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config', { cause: defaultConfig.issues })
  }

  return defaultConfig.output
}
