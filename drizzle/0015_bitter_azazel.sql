CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text DEFAULT 'telegram' NOT NULL,
	"platform_user_id" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'user' NOT NULL,
	"created_at" bigint DEFAULT 0 NOT NULL,
	"updated_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "from_user_uuid" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "users_platform_platform_user_id_unique_index" ON "users" USING btree ("platform","platform_user_id");--> statement-breakpoint
CREATE INDEX "users_platform_user_id_index" ON "users" USING btree ("platform_user_id");--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_from_user_uuid_users_id_fk" FOREIGN KEY ("from_user_uuid") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_from_user_uuid_index" ON "chat_messages" USING btree ("from_user_uuid");