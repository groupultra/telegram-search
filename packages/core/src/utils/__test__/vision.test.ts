import { generateText } from '@xsai/generate-text'
import { describe, expect, it, vi } from 'vitest'

import { describeImage } from '../vision'

vi.mock('@xsai/generate-text', () => ({ generateText: vi.fn(async () => ({ text: ' A cat. ' })) }))

describe('utils/vision', () => {
  it('sends the image as a data URL and keeps a zero temperature', async () => {
    const description = (await describeImage(
      { bytes: new Uint8Array([0xFF, 0xD8, 0xFF]), mimeType: 'image/webp' },
      { model: 'vl', apiKey: 'key', apiBase: 'https://vision.local', temperature: 0, maxTokens: 256 },
    )).unwrap()

    expect(description).toBe('A cat.')
    const request = vi.mocked(generateText).mock.calls[0][0] as any
    expect(request.messages[0].content[1].image_url.url).toBe('data:image/webp;base64,/9j/')
    // Before the fix `temperature || 0.7` turned a configured 0 into 0.7.
    expect(request.temperature).toBe(0)
    expect(request.maxTokens).toBe(256)
  })

  it('requires apiBase and model', async () => {
    const result = await describeImage({ bytes: new Uint8Array([1]) }, { model: '', apiKey: 'key', apiBase: '', temperature: 0.7, maxTokens: 1024 })
    expect(result.orUndefined()).toBeUndefined()
  })
})
