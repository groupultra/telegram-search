ALTER TABLE "chat_messages" ADD COLUMN "forward" jsonb DEFAULT '{"isForward":false}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "media" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "links" jsonb DEFAULT '[]'::jsonb NOT NULL;