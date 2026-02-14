import type { Buffer } from 'node:buffer'

import type { Result } from '@unbird/result'

import type { LLMConfig, VisionLLMConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { generateText } from '@xsai/generate-text'

export interface DescribeImageResult {
  description: string
}

export async function describeImage(
  imageData: Buffer | Uint8Array,
  visionConfig: VisionLLMConfig | LLMConfig,
): Promise<Result<DescribeImageResult>> {
  try {
    // 检查必需的配置
    if (!visionConfig.apiBase || !visionConfig.model) {
      return Err('Vision LLM apiBase and model are required for photo embedding')
    }

    // 将图片转换为 base64
    let base64Image: string
    if (imageData instanceof Uint8Array) {
      // 浏览器环境：Uint8Array -> base64
      const binaryString = Array.from(imageData)
        .map(byte => String.fromCharCode(byte))
        .join('')
      base64Image = btoa(binaryString)
    }
    else {
      // Node.js 环境：Buffer -> base64
      base64Image = (imageData as unknown as Buffer).toString('base64')
    }

    // 根据文件头判断 MIME 类型
    let mimeType = 'image/jpeg'
    if (imageData[0] === 0x89 && imageData[1] === 0x50) {
      mimeType = 'image/png'
    }
    else if (imageData[0] === 0x47 && imageData[1] === 0x49) {
      mimeType = 'image/gif'
    }
    else if (imageData[0] === 0x52 && imageData[1] === 0x49) {
      mimeType = 'image/webp'
    }

    // 构造 data URL
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    // 使用 xsai 调用多模态模型
    const result = await generateText({
      baseURL: visionConfig.apiBase,
      model: visionConfig.model,
      apiKey: visionConfig.apiKey,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in 1-2 sentences. Focus only on the main subject and key details. Be concise and specific.',
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl,
              },
            },
          ],
        },
      ],
      maxTokens: visionConfig.maxTokens || 1024,
      temperature: visionConfig.temperature || 0.7,
    })

    const description = result.text

    if (!description) {
      return Err('No description generated from the model')
    }

    return Ok({ description })
  }
  catch (err) {
    return Err(err)
  }
}
