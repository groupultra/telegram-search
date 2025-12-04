import fs from 'node:fs'

// eslint-disable-next-line unicorn/prefer-node-protocol
import { Buffer } from 'buffer'

import path from 'pathe'

import { useLogger } from '@guiiai/logg'
import { getDataPath } from '@tg-search/common/node'

const DICT_URL = 'https://github.com/fxsjy/jieba/raw/master/extra_dict/dict.txt.small'
const DICT_PATH = path.resolve(getDataPath(), 'dict.txt')

async function downloadDict(): Promise<Buffer> {
  const logger = useLogger('jieba:downloader')

  try {
    logger.withFields({ url: DICT_URL }).log('Downloading jieba dictionary')
    const response = await fetch(DICT_URL)

    if (!response.ok) {
      throw new Error(`Failed to download dict: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    // Cache the dictionary locally
    fs.writeFileSync(DICT_PATH, buffer)
    logger.log('Dictionary downloaded and cached successfully')

    return buffer
  }
  catch (error) {
    logger.withError(error).error('Failed to download jieba dictionary')
    throw error
  }
}

export async function loadDict() {
  let dictBuffer: Buffer

  const logger = useLogger('jieba:loader')

  // Try to load from cache first
  if (fs.existsSync(DICT_PATH)) {
    logger.withFields({ dictPath: DICT_PATH }).log('Loading cached jieba dict')
    dictBuffer = fs.readFileSync(DICT_PATH)
  }
  else {
    // Download if not cached
    dictBuffer = await downloadDict()
  }

  return dictBuffer
}
