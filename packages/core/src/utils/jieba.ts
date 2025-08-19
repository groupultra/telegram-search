import { Buffer } from 'node:buffer'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { Jieba } from '@node-rs/jieba'
import { getDataPath } from '@tg-search/common/node'
import { useLogger } from '@unbird/logg'

let _jieba: Jieba | undefined

const DICT_URL = 'https://github.com/fxsjy/jieba/raw/master/extra_dict/dict.txt.small'
const DICT_PATH = resolve(getDataPath(), 'dict.txt')

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
    writeFileSync(DICT_PATH, buffer)
    logger.log('Dictionary downloaded and cached successfully')

    return buffer
  }
  catch (error) {
    logger.withError(error).error('Failed to download jieba dictionary')
    throw error
  }
}

export async function ensureJieba(): Promise<Jieba | undefined> {
  const logger = useLogger('jieba:loader')

  if (!_jieba) {
    try {
      let dictBuffer: Buffer

      // Try to load from cache first
      if (existsSync(DICT_PATH)) {
        logger.withFields({ dictPath: DICT_PATH }).log('Loading cached jieba dict')
        dictBuffer = readFileSync(DICT_PATH)
      }
      else {
        // Download if not cached
        dictBuffer = await downloadDict()
      }

      _jieba = Jieba.withDict(dictBuffer)
      logger.log('Jieba initialized successfully')
    }
    catch (error) {
      logger.withError(error).error('Failed to initialize jieba')
      // Return undefined on error, jieba is optional
      return undefined
    }
  }

  return _jieba
}
