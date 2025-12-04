-- 1) Drop the old unique index.
DROP INDEX IF EXISTS "chat_messages_platform_platform_message_id_in_chat_id_owner_account_id_unique_index";--> statement-breakpoint
-- 2) Add the in_chat_type column, initially allowing NULLs for backfilling.
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "in_chat_type" text;--> statement-breakpoint
-- 3) Backfill in_chat_type from joined_chats.chat_type where possible.
UPDATE "chat_messages" AS m
SET "in_chat_type" = j."chat_type"
FROM "joined_chats" AS j
WHERE m."in_chat_id" = j."chat_id"
  AND m."in_chat_type" IS NULL;--> statement-breakpoint
-- 4) For any remaining rows, set a default fallback value ('group' as example).
UPDATE "chat_messages" AS m
SET "in_chat_type" = 'group'
WHERE m."in_chat_type" IS NULL;--> statement-breakpoint
-- 5) Remove duplicates with no owner: For rows where owner_account_id IS NULL,
--    keep the newest (by created_at), delete others with identical
--    platform/platform_message_id/in_chat_id/owner_account_id.
DELETE FROM "chat_messages" AS m
USING (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY
        "platform",
        "platform_message_id",
        "in_chat_id",
        "owner_account_id"
      ORDER BY "created_at" DESC
    ) AS rn
  FROM "chat_messages"
  WHERE "owner_account_id" IS NULL
) AS d
WHERE m.ctid = d.ctid
  AND d.rn > 1;
-- 6) After backfill and deduplication, make in_chat_type NOT NULL.
ALTER TABLE "chat_messages"
  ALTER COLUMN "in_chat_type" SET NOT NULL;--> statement-breakpoint
-- 7) Add the new UNIQUE constraint, using NULLS NOT DISTINCT
--    so that rows with owner_account_id NULL in same group/channel still conflict.
ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_platform_platform_message_id_in_chat_id_owner_account_id_unique_index"
  UNIQUE NULLS NOT DISTINCT("platform","platform_message_id","in_chat_id","owner_account_id");--> statement-breakpoint
