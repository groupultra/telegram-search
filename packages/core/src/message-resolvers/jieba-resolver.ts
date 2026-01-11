import type { Logger } from '@guiiai/logg'

import type { MessageResolver, MessageResolverOpts } from '.'
import type { ProcessedCoreMessage } from '../types/message'

import { Err, Ok } from '@unbird/result'

import { ensureJieba } from '../utils/jieba'

export function createJiebaResolver(logger: Logger): MessageResolver {
  logger = logger.withContext('core:resolver:jieba')

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing jieba resolver')

      const messages: ProcessedCoreMessage[] = opts.messages.filter(message => message.content)

      if (messages.length === 0)
        return Ok([])

      // Initialize jieba asynchronously
      const jieba = await ensureJieba(logger)
      if (!jieba) {
        logger.warn('Jieba not available, skipping tokenization')
        return Err('Jieba initialization failed')
      }

      const jiebaMessages = messages.map((message) => {
        // Token without empty strings
        const tokens = jieba.cut(message.content).filter(token => !!token)
        logger.withFields({ message: message.content, tokens }).debug('Jieba tokens')

        return {
          ...message,
          jiebaTokens: tokens,
        }
      })

      logger.withFields({ count: jiebaMessages.length }).verbose('Processed jieba messages')

      return Ok(jiebaMessages)
    },
  }
}
