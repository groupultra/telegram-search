CREATE TABLE "web_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status_code" integer DEFAULT 0 NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"fetched_at" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	"updated_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "settings" SET DEFAULT '{"embedding":{"model":"text-embedding-3-small","dimension":1536,"apiKey":"","apiBase":"","batchSize":10},"llm":{"model":"gpt-4o-mini","apiKey":"","apiBase":"https://api.openai.com/v1","temperature":0.7,"maxTokens":2000},"visionLLM":{"model":"qwen-vl-max","apiKey":"","apiBase":"","temperature":0.7,"maxTokens":1024},"firecrawl":{"apiKey":"","apiBase":"https://api.firecrawl.dev"},"resolvers":{"disabledResolvers":["avatar"]},"receiveMessages":{"receiveAll":true,"downloadMedia":true},"bot":{"enabled":false},"messageProcessing":{"receiveMessages":{"receiveAll":true,"downloadMedia":true},"resolvers":{"disabledResolvers":["avatar"]},"defaults":{"syncMedia":true,"maxMediaSize":0},"enablePhotoEmbedding":false}}'::jsonb;--> statement-breakpoint
CREATE UNIQUE INDEX "web_pages_url_unique_index" ON "web_pages" USING btree ("url");