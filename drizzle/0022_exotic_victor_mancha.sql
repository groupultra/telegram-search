ALTER TABLE "account_joined_chats" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_joined_chats" ADD COLUMN "access_hash" text;