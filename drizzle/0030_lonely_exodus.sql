ALTER TABLE "account_chat_folders" ALTER COLUMN "pinned_chat_ids" SET DATA TYPE bigint[];--> statement-breakpoint
ALTER TABLE "account_chat_folders" ALTER COLUMN "pinned_chat_ids" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "account_chat_folders" ALTER COLUMN "included_chat_ids" SET DATA TYPE bigint[];--> statement-breakpoint
ALTER TABLE "account_chat_folders" ALTER COLUMN "included_chat_ids" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "account_chat_folders" ALTER COLUMN "excluded_chat_ids" SET DATA TYPE bigint[];--> statement-breakpoint
ALTER TABLE "account_chat_folders" ALTER COLUMN "excluded_chat_ids" SET DEFAULT '{}';