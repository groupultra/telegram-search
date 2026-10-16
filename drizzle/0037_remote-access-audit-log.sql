CREATE TABLE "remote_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"credential_id" uuid NOT NULL,
	"credential_name" text NOT NULL,
	"account_id" uuid NOT NULL,
	"method" text NOT NULL,
	"chat_ids" jsonb NOT NULL,
	"decision" text NOT NULL,
	"outcome" text NOT NULL,
	"error_code" text,
	"request_summary" jsonb NOT NULL,
	"result_summary" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"user_agent" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "remote_audit_events_created_at_index" ON "remote_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "remote_audit_events_credential_id_created_at_index" ON "remote_audit_events" USING btree ("credential_id","created_at");--> statement-breakpoint
CREATE INDEX "remote_audit_events_account_id_created_at_index" ON "remote_audit_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "remote_audit_events_request_id_index" ON "remote_audit_events" USING btree ("request_id");