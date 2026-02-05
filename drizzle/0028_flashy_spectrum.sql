CREATE TABLE "account_chat_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"folder_id" integer NOT NULL,
	"title" text NOT NULL,
	"emoticon" text,
	"pinned_chat_ids" bigint[] DEFAULT '{}',
	"included_chat_ids" bigint[] DEFAULT '{}',
	"excluded_chat_ids" bigint[] DEFAULT '{}',
	"contacts" boolean DEFAULT false,
	"non_contacts" boolean DEFAULT false,
	"groups" boolean DEFAULT false,
	"broadcasts" boolean DEFAULT false,
	"bots" boolean DEFAULT false,
	"exclude_muted" boolean DEFAULT false,
	"exclude_read" boolean DEFAULT false,
	"exclude_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account_chat_folders" ADD CONSTRAINT "account_chat_folders_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_chat_folders_account_folder_unique" ON "account_chat_folders" USING btree ("account_id","folder_id");