import type { Buffer } from 'node:buffer'

import type { Result } from '@unbird/result'

import type { LLMConfig, VisionLLMConfig } from '../types/account-settings'

import { Err, Ok } from '@unbird/result'
import { generateText } from 'xsai'

export interface DescribeImageResult {
  description: string
}

/**
 * 使用多模态大语言模型生成图片描述
 * @param imageData 图片的二进制数据 (Buffer 或 Uint8Array)
 * @param visionConfig Vision LLM 配置(使用账户设置中的 Vision LLM 配置)
 * @returns 图片描述文本
 */
export async function describeImage(
  imageData: Buffer | Uint8Array,
  visionConfig: VisionLLMConfig | LLMConfig,
): Promise<Result<DescribeImageResult>> {
  try {
    console.log('[describeImage] Starting image description', {
      dataType: imageData instanceof Uint8Array ? 'Uint8Array' : 'Buffer',
      dataLength: imageData?.length,
      firstBytes: imageData?.slice(0, 4),
      hasApiBase: !!visionConfig.apiBase,
      hasModel: !!visionConfig.model,
      hasApiKey: !!visionConfig.apiKey,
    })

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
      console.log('[describeImage] Converted Uint8Array to base64', {
        base64Length: base64Image.length,
        base64Preview: base64Image.substring(0, 50),
      })
    }
    else {
      // Node.js 环境：Buffer -> base64
      base64Image = imageData.toString('base64')
      console.log('[describeImage] Converted Buffer to base64', {
        base64Length: base64Image.length,
        base64Preview: base64Image.substring(0, 50),
      })
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

    console.log('[describeImage] Detected MIME type', { mimeType })

    // 构造 data URL
    const dataUrl = `data:${mimeType};base64,${base64Image}`
    console.log('[describeImage] Created data URL', {
      dataUrlLength: dataUrl.length,
      dataUrlPreview: dataUrl.substring(0, 100),
    })

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
