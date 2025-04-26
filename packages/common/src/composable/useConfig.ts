import type { CoreConfig } from '../schema/config'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import defu from 'defu'
import { safeParse } from 'valibot'
import { parse, stringify } from 'yaml'

import { coreConfigSchema } from '../schema/config'

let config: CoreConfig

export function useConfigPath(): string {
  const configPath = join(homedir(), '.telegram-search', 'config.yaml')

  const defaultConfig = generateDefaultConfig()
  if (!existsSync(configPath)) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(defaultConfig))
  }

  return configPath
}

export function getSessionPath(storagePath: string) {
  return join(storagePath, 'sessions')
}

export function getMediaPath(storagePath: string) {
  return join(storagePath, 'media')
}

export function generateDefaultConfig(): CoreConfig {
  const storageDir = join(homedir(), '.telegram-search')

  const defaultConfig = safeParse(coreConfigSchema, {
    // Database settings
    database: {
      // Default database connection settings
      host: 'localhost',
      port: 5432,
      user: 'postgres',
      password: 'postgres',
      database: 'postgres',
    },

    // Message settings
    message: {
      // Export settings
      export: {
        // Number of messages to fetch in each request
        batchSize: 200,
        // Number of concurrent requests
        concurrent: 3,
        // Number of retry attempts
        retryTimes: 3,
        // Number of retry attempts for takeout session (0 means infinite retries)
        maxTakeoutRetries: 3,
      },
      // Database batch settings
      batch: {
        // Number of messages to save in each batch
        size: 100,
      },
    },

    // Path settings
    path: {
      storage: storageDir,
    },

    // API settings
    api: {
      // Telegram API settings
      telegram: {
        // These values should be provided in config.yaml
        apiId: '',
        apiHash: '',
        phoneNumber: '',
        // Optional proxy settings - will be used if provided
        // proxy: {
        //   ip: '',            // Proxy host (IP or hostname)
        //   port: 0,           // Proxy port
        //   MTProxy: false,    // Whether it's an MTProxy or a normal Socks proxy
        //   secret: '',        // If using MTProxy, provide a secret
        //   socksType: 5,      // If using Socks, choose 4 or 5
        //   timeout: 2,        // Timeout (in seconds) for connection
        //   username: '',      // Optional username for proxy auth
        //   password: '',      // Optional password for proxy auth
        // }
      },
      // OpenAI API settings
      embedding: {
        // Embedding provider
        provider: 'openai',
        // Embedding model
        model: 'text-embedding-3-small',
        // API key should be provided in config.yaml
        apiKey: '',
        // Optional API base URL
        apiBase: '',
      },
    },
  })

  if (!defaultConfig.success) {
    throw new Error('Failed to generate default config')
  }

  return defaultConfig.output
}

export function getDatabaseDSN(config: CoreConfig): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

function initConfig(): CoreConfig {
  const configPath = useConfigPath()

  const configData = readFileSync(configPath, 'utf-8')
  const configParsedData = parse(configData)

  const mergedConfig = defu({}, configParsedData, generateDefaultConfig())
  const validatedConfig = safeParse(coreConfigSchema, mergedConfig)

  if (!validatedConfig.success) {
    throw new Error('Failed to validate config')
  }

  validatedConfig.output.database.url = getDatabaseDSN(validatedConfig.output)

  config = validatedConfig.output
  return config
}

export function updateConfig(newConfig: Partial<CoreConfig>): CoreConfig {
  const configPath = useConfigPath()

  const mergedConfig = defu(config, newConfig)
  const validatedConfig = safeParse(coreConfigSchema, mergedConfig)

  if (!validatedConfig.success) {
    throw new Error('Failed to validate config')
  }

  writeFileSync(configPath, stringify(validatedConfig.output))

  config = validatedConfig.output
  return config
}

export function useConfig(): CoreConfig {
  if (!config) {
    config = initConfig()
  }

  return config
}
