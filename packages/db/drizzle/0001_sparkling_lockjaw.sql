CREATE TABLE "sync_config_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"sync_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'idle' NOT NULL,
	"priority" integer DEFAULT 0,
	"last_sync_time" timestamp,
	"last_message_id" bigint,
	"metadata_version" integer,
	"last_error" text,
	"options" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_sync_items_chat_type" ON "sync_config_items" USING btree ("chat_id","sync_type");--> statement-breakpoint
CREATE INDEX "idx_sync_config_items_status" ON "sync_config_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sync_config_items_priority" ON "sync_config_items" USING btree ("priority");