import type { Config } from './config-schema'

import { useLogger } from '@unbird/logg'
import { useLocalStorage } from '@vueuse/core'
import defu from 'defu'
import { safeParse } from 'valibot'

import { configSchema, generateDefaultConfig } from './config-schema'

const logger = useLogger('common:config')
let config: Config

const configStorage = useLocalStorage('settings/config', generateDefaultConfig())

export async function initConfig(): Promise<Config> {
  if (!config) {
    // 尝试从 localStorage 加载，如果没有则使用默认配置
    const savedConfig = configStorage.value
    if (savedConfig) {
      const validatedConfig = safeParse(configSchema, savedConfig)
      if (validatedConfig.success) {
        config = validatedConfig.output
        return config
      }
    }
    config = generateDefaultConfig()
  }

  return config
}

export async function updateConfig(newConfig: Partial<Config>): Promise<Config> {
  const mergedConfig = defu({}, newConfig, config)
  const validatedConfig = safeParse(configSchema, mergedConfig)

  if (!validatedConfig.success) {
    logger.withFields({ issues: validatedConfig.issues }).error('Failed to validate config')
    throw new Error('Failed to validate config')
  }

  logger.withFields({ config: validatedConfig.output }).log('Updating config')

  config = validatedConfig.output

  // 保存到 localStorage
  configStorage.value = config

  return config
}

export function useConfig(): Config {
  if (!config) {
    initConfig()
  }

  return config
}
