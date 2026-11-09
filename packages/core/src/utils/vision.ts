import type { Result } from '@unbird/result'

import type { VisionLLMConfig } from '../types/account-settings'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import { Err, Ok } from '@unbird/result'
import { generateText } from '@xsai/generate-text'

const DESCRIBE_IMAGE_PROMPT = 'Describe this image in 1-2 sentences. Focus only on the main subject and key details. Be concise and specific.'

export interface VisionImage {
  bytes: Uint8Array
  /**
   * MIME type recorded by the media resolver. Telegram photos are JPEG, so that is the fallback.
   */
  mimeType?: string
}

/**
 * Generate a short description of an image with a multimodal model.
 */
export async function describeImage(image: VisionImage, visionConfig: VisionLLMConfig): Promise<Result<string>> {
  try {
    // Fail fast to avoid sending malformed requests to the vision provider.
    if (!visionConfig.apiBase || !visionConfig.model) {
      return Err('Vision LLM apiBase and model are required for photo embedding')
    }

    // The `buffer` package keeps base64 encoding identical in Node and the browser.
    const base64Image = Buffer.from(image.bytes.buffer, image.bytes.byteOffset, image.bytes.byteLength).toString('base64')
    const dataUrl = `data:${image.mimeType || 'image/jpeg'};base64,${base64Image}`

    const result = await generateText({
      baseURL: visionConfig.apiBase,
      model: visionConfig.model,
      apiKey: visionConfig.apiKey,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: DESCRIBE_IMAGE_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      maxTokens: visionConfig.maxTokens,
      temperature: visionConfig.temperature,
    })

    const description = result.text?.trim()
    if (!description) {
      return Err('No description generated from the model')
    }

    return Ok(description)
  }
  catch (err) {
    return Err(err)
  }
}
