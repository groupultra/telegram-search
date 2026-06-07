import { describe, expect, it } from 'vitest'

import { detectProviderFromApiBase, LLM_PROVIDER_KEYS, LLM_PROVIDERS } from '../llm-providers'

describe('llm-providers', () => {
  describe('lLM_PROVIDERS', () => {
    it('should contain openai and minimax providers', () => {
      expect(LLM_PROVIDERS).toHaveProperty('openai')
      expect(LLM_PROVIDERS).toHaveProperty('minimax')
    })

    it('should have valid openai preset', () => {
      const openai = LLM_PROVIDERS.openai
      expect(openai.label).toBe('OpenAI')
      expect(openai.apiBase).toBe('https://api.openai.com/v1')
      expect(openai.defaultModel).toBe('gpt-4o-mini')
      expect(openai.models.length).toBeGreaterThan(0)
    })

    it('should have valid minimax preset', () => {
      const minimax = LLM_PROVIDERS.minimax
      expect(minimax.label).toBe('MiniMax')
      expect(minimax.apiBase).toBe('https://api.minimax.io/v1')
      expect(minimax.defaultModel).toBe('MiniMax-M3')
      expect(minimax.models).toContain('MiniMax-M3')
      expect(minimax.models).toContain('MiniMax-M2.7')
      expect(minimax.models).toContain('MiniMax-M2.7-highspeed')
      expect(minimax.models[0]).toBe('MiniMax-M3')
    })

    it('should have unique apiBase for each provider', () => {
      const bases = Object.values(LLM_PROVIDERS).map(p => p.apiBase)
      expect(new Set(bases).size).toBe(bases.length)
    })

    it('should have non-empty label and defaultModel for each provider', () => {
      for (const [key, preset] of Object.entries(LLM_PROVIDERS)) {
        expect(preset.label, `${key} label`).toBeTruthy()
        expect(preset.defaultModel, `${key} defaultModel`).toBeTruthy()
        expect(preset.models.length, `${key} models`).toBeGreaterThan(0)
      }
    })

    it('should include defaultModel in models list', () => {
      for (const [key, preset] of Object.entries(LLM_PROVIDERS)) {
        expect(preset.models, `${key} models should include defaultModel`).toContain(preset.defaultModel)
      }
    })
  })

  describe('lLM_PROVIDER_KEYS', () => {
    it('should contain all provider keys', () => {
      expect(LLM_PROVIDER_KEYS).toContain('openai')
      expect(LLM_PROVIDER_KEYS).toContain('minimax')
    })

    it('should match Object.keys of LLM_PROVIDERS', () => {
      expect(LLM_PROVIDER_KEYS).toEqual(Object.keys(LLM_PROVIDERS))
    })
  })

  describe('detectProviderFromApiBase', () => {
    it('should detect openai provider', () => {
      expect(detectProviderFromApiBase('https://api.openai.com/v1')).toBe('openai')
    })

    it('should detect minimax provider', () => {
      expect(detectProviderFromApiBase('https://api.minimax.io/v1')).toBe('minimax')
    })

    it('should return undefined for unknown URL', () => {
      expect(detectProviderFromApiBase('https://api.example.com/v1')).toBeUndefined()
    })

    it('should return undefined for empty string', () => {
      expect(detectProviderFromApiBase('')).toBeUndefined()
    })

    it('should not match partial URLs', () => {
      expect(detectProviderFromApiBase('https://api.openai.com')).toBeUndefined()
      expect(detectProviderFromApiBase('https://api.minimax.io')).toBeUndefined()
    })
  })
})
