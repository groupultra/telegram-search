CREATE TABLE "bot_scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"task_type" text NOT NULL,
	"schedule" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_run_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "settings" SET DEFAULT '{"embedding":{"model":"text-embedding-3-small","dimension":1536,"apiKey":"","apiBase":""},"llm":{"model":"gpt-4o-mini","apiKey":"","apiBase":"https://api.openai.com/v1","temperature":0.7,"maxTokens":2000},"resolvers":{"disabledResolvers":["avatar"]},"receiveMessages":{"receiveAll":true},"bot":{"enabled":false}}'::jsonb;--> statement-breakpoint
ALTER TABLE "bot_scheduled_tasks" ADD CONSTRAINT "bot_scheduled_tasks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;