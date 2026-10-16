import type { CursorPage, GetMessagesInput, GetMessagesResult, MessageRecord, ReadMessagesInput, ReadMessagesResult, ReplyContextInput, ReplyContextResult } from '@tg-search/protocol'

const keyOf = (reference: { chatId: string, messageId: string }) => `${reference.chatId}:${reference.messageId}`
const referenceOf = (message: MessageRecord) => ({ chatId: message.chatId, messageId: message.id })

/** Point reads are injected, so explicit local/Telegram source selection stays in the application. */
export function createReplyContextService(get: (input: GetMessagesInput) => Promise<GetMessagesResult>, checkpoint: () => void = () => {}) {
  return async (input: ReplyContextInput): Promise<ReplyContextResult> => {
    const records = new Map<string, MessageRecord>()
    const missing = new Set<string>()
    const roots: ReplyContextResult['roots'] = []
    const links: ReplyContextResult['links'] = []
    const rootIds = [...new Set(input.messageIds)]
    const selectedIds = rootIds.slice(0, input.maxNodes)
    checkpoint()
    const rootResult = await get({ source: input.source, chatId: input.chatId, messageIds: selectedIds, operation: input.operation })
    for (const message of rootResult.items)
      records.set(keyOf(referenceOf(message)), message)
    for (const id of rootResult.missingIds)
      missing.add(keyOf({ chatId: input.chatId, messageId: id }))
    for (const messageId of rootIds) {
      const reference = { chatId: input.chatId, messageId }
      roots.push({ ...reference, status: !selectedIds.includes(messageId) ? 'node_budget' : records.has(keyOf(reference)) ? 'resolved' : 'missing' })
    }

    const queue = rootResult.items.map(message => ({ message, depth: 0 }))
    const processed = new Set<string>()
    const edges = new Map<string, string>()
    // Missing point reads also spend budget, keeping unavailable references bounded.
    let requestedNodes = selectedIds.length
    for (let index = 0; index < queue.length; index++) {
      checkpoint()
      const { message, depth } = queue[index]
      const from = referenceOf(message)
      const fromKey = keyOf(from)
      if (processed.has(fromKey))
        continue
      processed.add(fromKey)
      if (!message.replyToId)
        continue
      const to = { chatId: message.replyToChatId ?? message.chatId, messageId: message.replyToId }
      const toKey = keyOf(to)
      const link: ReplyContextResult['links'][number] = { from, to, status: 'resolved' }
      links.push(link)
      if (to.chatId !== input.chatId) {
        // Cross-chat point reads need their own explicit scope; never infer authority from a reply.
        link.status = 'not_requested'
        link.reason = 'cross_chat'
        continue
      }
      if (input.maxDepth === 0) {
        link.status = 'not_requested'
        link.reason = 'depth_zero'
        continue
      }
      if (depth >= input.maxDepth) {
        link.status = 'depth_budget'
        continue
      }
      let ancestor: string | undefined = toKey
      const seen = new Set<string>()
      while (ancestor && !seen.has(ancestor)) {
        if (ancestor === fromKey) {
          link.status = 'cycle'
          break
        }
        seen.add(ancestor)
        ancestor = edges.get(ancestor)
      }
      edges.set(fromKey, toKey)
      if (link.status === 'cycle')
        continue
      if (missing.has(toKey)) {
        link.status = 'missing'
        continue
      }
      if (!records.has(toKey)) {
        if (requestedNodes >= input.maxNodes) {
          link.status = 'node_budget'
          continue
        }
        requestedNodes++
        const result = await get({ source: input.source, chatId: to.chatId, messageIds: [to.messageId], operation: input.operation })
        for (const record of result.items)
          records.set(keyOf(referenceOf(record)), record)
        if (!records.has(toKey)) {
          missing.add(toKey)
          link.status = 'missing'
          continue
        }
      }
      queue.push({ message: records.get(toKey)!, depth: depth + 1 })
    }
    const count = (status: ReplyContextResult['links'][number]['status']) => links.filter(link => link.status === status).length
    return { source: input.source, items: [...records.values()], roots, links, budget: { maxDepth: input.maxDepth, maxNodes: input.maxNodes }, coverage: { complete: roots.every(root => root.status === 'resolved') && links.every(link => link.status === 'resolved' || link.status === 'cycle'), resolvedReplies: count('resolved'), missingReplies: count('missing'), notRequestedReplies: count('not_requested'), depthStopped: count('depth_budget'), nodeStopped: count('node_budget') + roots.filter(root => root.status === 'node_budget').length, cycles: count('cycle') } }
  }
}

type PageRequest = Pick<ReadMessagesInput, 'source' | 'chatId' | 'cursor' | 'from' | 'to' | 'operation'> & { limit: number }

/** A finished time window says nothing about unresolved replies or unread attachments. */
export function createWindowReadService(fetchPage: (input: PageRequest) => Promise<CursorPage<MessageRecord>>, checkpoint: () => void = () => {}) {
  return async (input: ReadMessagesInput): Promise<ReadMessagesResult> => {
    const items = new Map<string, MessageRecord>()
    const cursors = new Set<string>()
    let cursor = input.cursor
    let nextCursor: string | null = cursor ?? null
    let pagesRead = 0
    let stopReason: ReadMessagesResult['stopReason'] = 'page_budget'
    while (pagesRead < input.maxPages) {
      checkpoint()
      const page = await fetchPage({ source: input.source, chatId: input.chatId, cursor, from: input.from, to: input.to, limit: Math.min(input.pageSize, input.maxMessages - items.size), operation: input.operation })
      pagesRead++
      for (const message of page.items)
        items.set(keyOf(referenceOf(message)), message)
      nextCursor = page.nextCursor
      if (nextCursor === null) {
        stopReason = 'exhausted'
        break
      }
      if (nextCursor === cursor || cursors.has(nextCursor)) {
        stopReason = 'cursor_stalled'
        break
      }
      cursors.add(nextCursor)
      if (items.size >= input.maxMessages) {
        stopReason = 'message_budget'
        break
      }
      cursor = nextCursor
    }
    return { source: input.source, chatId: input.chatId, items: [...items.values()], window: { from: input.from, to: input.to }, nextCursor, pagesRead, stopReason, coverage: { windowExhausted: stopReason === 'exhausted', replyContext: 'not_requested', mediaContent: 'not_requested' } }
  }
}
