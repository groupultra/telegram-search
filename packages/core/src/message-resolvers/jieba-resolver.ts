import type { MessageResolver, MessageResolverOpts } from '.'
import type { CoreMessage } from '../utils/message'

import { existsSync } from 'node:fs'
import { useLogger } from '@tg-search/common'
import { useConfig } from '@tg-search/common/composable'
import nodejieba from 'nodejieba'

import { Err, Ok } from '../utils/monad'

const { cut, load } = nodejieba

export function createJiebaResolver(): MessageResolver {
  const logger = useLogger('core:resolver:jieba')

  const dictPath = useConfig().path.dict
  if (existsSync(dictPath)) {
    logger.withFields({ dictPath }).log('Loading jieba dict')
    load({
      userDict: dictPath,
    })
  }

  return {
    run: async (opts: MessageResolverOpts) => {
      logger.verbose('Executing jieba resolver')

      if (opts.messages.length === 0)
        return Err('No messages')

      const messages: CoreMessage[] = opts.messages.filter(
        message => message.content && message.jiebaTokens.length === 0,
      )

      if (messages.length === 0)
        return Err('No messages to parse')

      const jiebaMessages = messages.map((message) => {
        // Token without empty strings
        const tokens = cut(message.content).filter(token => !!token)
        logger.withFields({ message: message.content, tokens }).debug('Jieba tokens')

        return {
          ...message,
          jiebaTokens: tokens,
        }
      })

      logger.withFields({ messages: jiebaMessages.length }).verbose('Processed jieba messages')

      return Ok(jiebaMessages)
    },
  }
}
