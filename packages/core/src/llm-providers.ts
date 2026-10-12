export interface LLMProviderPreset {
  label: string
  apiBase: string
  defaultModel: string
  models: string[]
}

export const LLM_PROVIDERS = {
  openai: {
    label: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o3-mini'],
  },
  minimax: {
    label: 'MiniMax',
    apiBase: 'https://api.minimax.io/v1',
    defaultModel: 'MiniMax-M3',
    models: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
  },
} as const satisfies Record<string, LLMProviderPreset>

export type LLMProviderKey = keyof typeof LLM_PROVIDERS

export const LLM_PROVIDER_KEYS = Object.keys(LLM_PROVIDERS) as LLMProviderKey[]

/**
 * Detect provider key from an API base URL.
 * Returns `undefined` for unrecognised or custom endpoints.
 */
export function detectProviderFromApiBase(apiBase: string): LLMProviderKey | undefined {
  for (const [key, preset] of Object.entries(LLM_PROVIDERS)) {
    if (apiBase === preset.apiBase) {
      return key as LLMProviderKey
    }
  }
  return undefined
}
