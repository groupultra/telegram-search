ALTER TABLE "recent_sent_stickers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP VIEW "public"."chat_message_stats";--> statement-breakpoint
DROP TABLE "recent_sent_stickers" CASCADE;--> statement-breakpoint
DROP INDEX "chat_messages_platform_platform_message_id_in_chat_id_unique_index";--> statement-breakpoint
ALTER TABLE "account_joined_chats" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "created_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "updated_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "owner_account_id" uuid;--> statement-breakpoint
ALTER TABLE "account_joined_chats" ADD CONSTRAINT "account_joined_chats_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_joined_chats" ADD CONSTRAINT "account_joined_chats_joined_chat_id_joined_chats_id_fk" FOREIGN KEY ("joined_chat_id") REFERENCES "public"."joined_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_owner_account_id_accounts_id_fk" FOREIGN KEY ("owner_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_platform_platform_message_id_in_chat_id_owner_account_id_unique_index" ON "chat_messages" USING btree ("platform","platform_message_id","in_chat_id","owner_account_id");