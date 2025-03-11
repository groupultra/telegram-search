export interface ClientProxyConfig {
  ip: string
  port: number
  MTProxy?: boolean
  secret?: string
  socksType?: 4 | 5
  timeout?: number
  username?: string
  password?: string
}

export interface DatabaseConfig {
  url?: string
  host: string
  port: number
  user: string
  password: string
  database: string
}

export interface MessageConfig {
  export: {
    batchSize: number
    concurrent: number
    retryTimes: number
    maxTakeoutRetries: number
  }
  batch: {
    size: number
  }
}

export interface PathConfig {
  session: string
  media: string
}

export interface ApiConfig {
  telegram: {
    apiId: string
    apiHash: string
    phoneNumber: string
    proxy?: ClientProxyConfig
  }
  embedding: {
    provider: 'ollama' | 'openai'
    model: string
    apiKey?: string
    apiBase?: string
  }
}

export interface Config {
  database: DatabaseConfig
  message: MessageConfig
  path: PathConfig
  api: ApiConfig
}
