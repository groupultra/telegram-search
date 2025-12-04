CREATE TABLE "account_joined_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"joined_chat_id" uuid NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text DEFAULT 'telegram' NOT NULL,
	"platform_user_id" text DEFAULT '' NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	"updated_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "account_joined_chats_account_joined_chat_unique_index" ON "account_joined_chats" USING btree ("account_id","joined_chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_platform_platform_user_id_unique_index" ON "accounts" USING btree ("platform","platform_user_id");