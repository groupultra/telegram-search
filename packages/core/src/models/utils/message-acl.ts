import { sql } from 'drizzle-orm'

import { chatMessagesTable } from '../../schemas/chat-messages'

/**
 * Message read ACL: an account sees messages it owns and shared ones.
 *
 * `recordMessages` stores private-dialog messages with `owner_account_id` set
 * and group/channel messages with it NULL, so ownership alone decides access.
 * Do not branch on `joined_chats.chat_type` here: that row is shared by every
 * account and rewritten on each dialog sync, so it cannot guard private data.
 */
export function ownerScopedCondition(accountId: string) {
  return sql`(
    ${chatMessagesTable.owner_account_id} = ${accountId}
    OR ${chatMessagesTable.owner_account_id} IS NULL
  )`
}
