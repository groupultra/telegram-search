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
  }
  embedding: {
    provider: 'ollama' | 'openai'
    model: string
    dimensions: number
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
