DROP INDEX IF EXISTS "chat_messages_platform_platform_message_id_in_chat_id_unique_index";--> statement-breakpoint

ALTER TABLE "account_joined_chats" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_messages'
      AND column_name = 'owner_account_id'
  ) THEN
    ALTER TABLE "chat_messages" ADD COLUMN "owner_account_id" uuid;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'account_joined_chats'
      AND constraint_name = 'account_joined_chats_account_id_accounts_id_fk'
  ) THEN
    ALTER TABLE "account_joined_chats"
      ADD CONSTRAINT "account_joined_chats_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'account_joined_chats'
      AND constraint_name = 'account_joined_chats_joined_chat_id_joined_chats_id_fk'
  ) THEN
    ALTER TABLE "account_joined_chats"
      ADD CONSTRAINT "account_joined_chats_joined_chat_id_joined_chats_id_fk"
      FOREIGN KEY ("joined_chat_id") REFERENCES "public"."joined_chats"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'chat_messages'
      AND constraint_name = 'chat_messages_owner_account_id_accounts_id_fk'
  ) THEN
    ALTER TABLE "chat_messages"
      ADD CONSTRAINT "chat_messages_owner_account_id_accounts_id_fk"
      FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$$;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_platform_platform_message_id_in_chat_id_owner_account_id_unique_index"
  ON "chat_messages" USING btree ("platform","platform_message_id","in_chat_id","owner_account_id");
