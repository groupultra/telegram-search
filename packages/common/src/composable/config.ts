import type { Config } from '../types/config'

import * as fs from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { defu } from 'defu'
import * as yaml from 'yaml'

import { useLogger } from '../helper/logger'
import { findConfigDir, resolveHomeDir } from '../helper/path'

/**
 * Get database connection string from config
 */
export function getDatabaseDSN(config: Config): string {
  const { database } = config
  return database.url || `postgres://${database.user}:${database.password}@${database.host}:${database.port}/${database.database}`
}

/**
 * Default configuration with detailed comments
 */
const DEFAULT_CONFIG = {
  // Database settings
  database: {
    // Default database connection settings
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'tg_search',
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
    // Session storage path
    session: join(os.homedir(), '.telegram-search/session'),
    // Media storage path
    media: join(os.homedir(), '.telegram-search/media'),
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
      // Embedding dimensions
      dimensions: 1536,
    },
  },
} as const satisfies Config

let config: Config | null = null

/**
 * Find config file path
 */
function findConfigFile(): string {
  const configDir = process.env.CONFIG_DIR || findConfigDir()
  const configPath = join(configDir, `config${process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''}.yaml`)

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`)
  }

  return configPath
}

/**
 * Load YAML configuration file
 */
function loadYamlConfig(configPath: string): Partial<Config> {
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return yaml.parse(content)
  }
  catch {
    const logger = useLogger()
    logger.debug(`Failed to load config file: ${configPath}`)
    return {}
  }
}

/**
 * Validate required configuration fields
 */
function validateConfig(config: Config) {
  const required = [
    'api.telegram.apiId',
    'api.telegram.apiHash',
    'api.telegram.phoneNumber',
    'api.embedding.provider',
    'api.embedding.model',
  ] as const

  for (const path of required) {
    const value = path.split('.').reduce((obj, key) => obj?.[key], config as any)
    if (!value) {
      throw new Error(`Missing required configuration: ${path}`)
    }
  }
}

/**
 * Save config to file
 */
function saveConfig(config: Config, configPath: string) {
  const logger = useLogger()

  try {
    // Create config directory if it doesn't exist
    const configDir = join(configPath).split(join(os.homedir(), '.telegram-search/session')).join(join(os.homedir(), '.telegram-search/session'))
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true })
    }

    // Write config to file
    fs.writeFileSync(
      configPath,
      yaml.stringify(config),
      'utf-8',
    )

    logger.debug('Config saved successfully')
  }
  catch (error) {
    logger.withError(error).error('Failed to save config')
    throw error
  }
}

/**
 * Initialize config
 */
export function initConfig() {
  if (config) {
    return
  }

  const logger = useLogger()

  try {
    // Find config directory
    const configPath = findConfigFile()
    logger.debug(`Using config file: ${configPath}`)

    // Load environment-specific config first (if exists)
    const envConfig = process.env.NODE_ENV
      ? loadYamlConfig(join(join(configPath).split(join(os.homedir(), '.telegram-search/session')).join(join(os.homedir(), '.telegram-search/session')), `config.${process.env.NODE_ENV}.yaml`))
      : {}

    // Load main config
    const mainConfig = loadYamlConfig(configPath)
    if (Object.keys(mainConfig).length === 0) {
      throw new Error('Main configuration file (config.yaml) not found or empty')
    }

    // Merge configurations with type assertion
    const mergedConfig = defu<Config, Partial<Config>[]>(mainConfig, envConfig, DEFAULT_CONFIG)

    // Resolve paths
    mergedConfig.path.session = resolveHomeDir(mergedConfig.path.session)
    mergedConfig.path.media = resolveHomeDir(mergedConfig.path.media)

    // Construct database URL if not provided
    if (!mergedConfig.database.url) {
      const { host, port, user, password, database } = mergedConfig.database
      mergedConfig.database.url = `postgres://${user}:${password}@${host}:${port}/${database}`
    }

    // Log merged config
    logger.withFields({ mergedConfig: JSON.stringify(mergedConfig) }).debug('Config initialized successfully')

    // Validate configuration
    validateConfig(mergedConfig)

    // Set global config
    config = mergedConfig

    logger.debug('Config initialized successfully')

    return mergedConfig
  }
  catch (error) {
    logger.withError(error).error('Failed to initialize config')
    throw error
  }
}

/**
 * Get current config
 */
export function getConfig(): Config {
  if (!config) {
    initConfig()
  }

  return config as Config
}

/**
 * Update config
 * This will merge the new config with the existing one and save it to file
 */
export function updateConfig(newConfig: Config): Config {
  const logger = useLogger()

  try {
    // Get current config and config file path
    const currentConfig = getConfig()
    const configPath = findConfigFile()

    // Merge new config with current config
    const mergedConfig = defu({}, currentConfig, newConfig)

    // Validate merged config
    validateConfig(mergedConfig)

    // Save config to file
    saveConfig(mergedConfig, configPath)

    // Update global config
    config = mergedConfig

    return mergedConfig
  }
  catch (error) {
    logger.withError(error).error('Failed to update config')
    throw error
  }
}
