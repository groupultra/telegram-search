import { existsSync, readFileSync } from 'node:fs'

import { Jieba } from '@node-rs/jieba'
import { useConfig } from '@tg-search/common/node'
import { useLogger } from '@unbird/logg'

let _jieba: Jieba | undefined

export function ensureJieba() {
  const logger = useLogger('jieba:loader')

  if (!_jieba) {
    const dictPath = useConfig().path.dict
    if (existsSync(dictPath)) {
      logger.withFields({ dictPath }).log('Loading jieba dict')
      _jieba = Jieba.withDict(readFileSync(dictPath))
    }
  }

  return _jieba
}
