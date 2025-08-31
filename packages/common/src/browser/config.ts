import type { Config } from '../config-schema'

import { useLogger } from '@unbird/logg'
import defu from 'defu'
import { safeParse } from 'valibot'

import { configSchema } from '../config-schema'
import { generateDefaultConfig } from '../default-config'

const logger = useLogger('common:config')
let config: Config

// 简单的 localStorage 包装器，不依赖 Vue
function getLocalStorage(key: string): any {
  if (typeof window === 'undefined')
    return null
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  }
  catch {
    return null
  }
}

function setLocalStorage(key: string, value: any): void {
  if (typeof window === 'undefined')
    return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  }
  catch {
    console.error('Failed to set localStorage')
  }
}

export async function initConfig(): Promise<Config> {
  if (!config) {
    // 尝试从 localStorage 加载，如果没有则使用默认配置
    const savedConfig = getLocalStorage('config')
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
  setLocalStorage('config', config)

  return config
}

export function useConfig(): Config {
  if (!config) {
    throw new Error('Config not initialized. Call initConfig() first.')
  }

  return config
}
