import type { InferOutput } from 'valibot'

import type { AppResult } from './errors'
import type { CursorPage } from './pagination'

import { defineInvokeEventa } from '@moeru/eventa'
import { array, maxValue, minValue, number, object, optional, picklist, pipe, string } from 'valibot'

export const chatTypeSchema = picklist(['user', 'bot', 'channel', 'group', 'supergroup'])

export const listChatsInputSchema = object({
  cursor: optional(string()),
  limit: optional(pipe(number(), minValue(1), maxValue(1000)), 100),
  types: optional(array(chatTypeSchema)),
})

export const chatRecordSchema = object({
  id: string(),
  name: string(),
  type: chatTypeSchema,
  username: optional(string()),
  lastMessage: optional(string()),
  lastMessageAt: optional(number()),
})

export type ListChatsInput = InferOutput<typeof listChatsInputSchema>
export type ChatRecord = InferOutput<typeof chatRecordSchema>
export type ListChatsResult = AppResult<CursorPage<ChatRecord>>

export const chatContracts = {
  list: defineInvokeEventa<ListChatsResult, ListChatsInput>('tg.v1.chats.list'),
}
