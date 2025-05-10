ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_platform_message_id_unique";--> statement-breakpoint
DROP INDEX "jieba_tokens_index";--> statement-breakpoint
CREATE INDEX "jieba_tokens_index" ON "chat_messages" USING gin ("jieba_tokens" jsonb_path_ops);