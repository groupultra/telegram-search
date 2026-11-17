CREATE TABLE "account_telegram_sessions" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_leases" (
	"name" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_telegram_sessions" ADD CONSTRAINT "account_telegram_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;