import type { Buffer } from 'node:buffer'

import type { Result } from '@unbird/result'

import type { LLMConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { generateText } from 'xsai'

export interface DescribeImageResult {
  description: string
}

/**
 * 使用多模态大语言模型生成图片描述
 * @param imageBuffer 图片的二进制数据
 * @param llmConfig LLM 配置(使用账户设置中的 LLM 配置)
 * @returns 图片描述文本
 */
export async function describeImage(
  imageBuffer: Buffer,
  llmConfig: LLMConfig,
): Promise<Result<DescribeImageResult>> {
  try {
    // 检查必需的配置
    if (!llmConfig.apiBase || !llmConfig.model) {
      return Err('LLM apiBase and model are required for photo embedding')
    }

    // 将图片转换为 base64
    const base64Image = imageBuffer.toString('base64')

    // 根据文件头判断 MIME 类型
    let mimeType = 'image/jpeg'
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      mimeType = 'image/png'
    }
    else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49) {
      mimeType = 'image/gif'
    }
    else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49) {
      mimeType = 'image/webp'
    }

    // 构造 data URL
    const dataUrl = `data:${mimeType};base64,${base64Image}`

    // 使用 xsai 调用多模态模型
    const result = await generateText({
      baseURL: llmConfig.apiBase,
      model: llmConfig.model,
      apiKey: llmConfig.apiKey,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Please describe this image in detail. Focus on the key elements, objects, people, text, colors, and overall context. Keep the description concise but informative.',
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
      maxTokens: llmConfig.maxTokens || 1024,
      temperature: llmConfig.temperature || 0.7,
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
