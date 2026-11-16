CREATE TABLE "auth_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_device_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"last_polled_at" timestamp with time zone,
	"polling_interval" integer,
	"client_id" text,
	"scope" text,
	"resources" text[],
	"oauth_client_id" text
);
--> statement-breakpoint
CREATE TABLE "auth_jwks" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"alg" text,
	"crv" text
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_access_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"refresh_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"revoked" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL,
	CONSTRAINT "auth_oauth_access_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_client_assertions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_client_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"client_secret" text,
	"client_discovery_id" text,
	"disabled" boolean DEFAULT false,
	"skip_consent" boolean,
	"enable_end_session" boolean,
	"subject_type" text,
	"scopes" text[],
	"client_credentials_scopes" text[] DEFAULT '{}',
	"user_id" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"name" text,
	"uri" text,
	"icon" text,
	"contacts" text[],
	"tos" text,
	"policy" text,
	"software_id" text,
	"software_version" text,
	"software_statement" text,
	"redirect_uris" text[] NOT NULL,
	"post_logout_redirect_uris" text[],
	"backchannel_logout_uri" text,
	"backchannel_logout_session_required" boolean,
	"token_endpoint_auth_method" text,
	"application_type" text,
	"jwks" text,
	"jwks_uri" text,
	"grant_types" text[],
	"response_types" text[],
	"require_p_k_c_e" boolean,
	"dpop_bound_access_tokens" boolean DEFAULT false,
	"reference_id" text,
	"metadata" jsonb,
	CONSTRAINT "auth_oauth_clients_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"user_id" text,
	"reference_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"scopes" text[] NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_refresh_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"client_id" text NOT NULL,
	"session_id" text,
	"user_id" text NOT NULL,
	"reference_id" text,
	"authorization_code_id" text,
	"resources" text[],
	"requested_user_info_claims" text[],
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone,
	"revoked" timestamp with time zone,
	"rotated_at" timestamp with time zone,
	"rotation_replay_response" text,
	"rotation_replay_expires_at" timestamp with time zone,
	"auth_time" timestamp with time zone,
	"confirmation" jsonb,
	"scopes" text[] NOT NULL,
	CONSTRAINT "auth_oauth_refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_oauth_resources" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"name" text NOT NULL,
	"access_token_ttl" integer,
	"refresh_token_ttl" integer,
	"signing_algorithm" text,
	"signing_key_id" text,
	"allowed_scopes" text[],
	"custom_claims" jsonb,
	"dpop_bound_access_tokens_required" boolean DEFAULT false,
	"disabled" boolean DEFAULT false,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"policy_version" integer DEFAULT 1,
	"metadata" jsonb,
	CONSTRAINT "auth_oauth_resources_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "auth_sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auth_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "remote_audit_events" ALTER COLUMN "credential_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "remote_audit_events" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_tokens" ADD CONSTRAINT "auth_oauth_access_tokens_client_id_auth_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."auth_oauth_clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_tokens" ADD CONSTRAINT "auth_oauth_access_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_tokens" ADD CONSTRAINT "auth_oauth_access_tokens_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_access_tokens" ADD CONSTRAINT "auth_oauth_access_tokens_refresh_id_auth_oauth_refresh_tokens_id_fk" FOREIGN KEY ("refresh_id") REFERENCES "public"."auth_oauth_refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_client_resources" ADD CONSTRAINT "auth_oauth_client_resources_client_id_auth_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."auth_oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_client_resources" ADD CONSTRAINT "auth_oauth_client_resources_resource_id_auth_oauth_resources_identifier_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."auth_oauth_resources"("identifier") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_clients" ADD CONSTRAINT "auth_oauth_clients_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_consents" ADD CONSTRAINT "auth_oauth_consents_client_id_auth_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."auth_oauth_clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_consents" ADD CONSTRAINT "auth_oauth_consents_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_tokens" ADD CONSTRAINT "auth_oauth_refresh_tokens_client_id_auth_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."auth_oauth_clients"("client_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_tokens" ADD CONSTRAINT "auth_oauth_refresh_tokens_session_id_auth_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_oauth_refresh_tokens" ADD CONSTRAINT "auth_oauth_refresh_tokens_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_auth_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_account_user_id_index" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_device_code_device_code_unique_index" ON "auth_device_codes" USING btree ("device_code");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_device_code_user_code_unique_index" ON "auth_device_codes" USING btree ("user_code");--> statement-breakpoint
CREATE INDEX "auth_oauth_access_token_client_id_index" ON "auth_oauth_access_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_access_token_session_id_index" ON "auth_oauth_access_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_access_token_user_id_index" ON "auth_oauth_access_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_access_token_authorization_code_id_index" ON "auth_oauth_access_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_access_token_refresh_id_index" ON "auth_oauth_access_tokens" USING btree ("refresh_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_client_resource_client_id_index" ON "auth_oauth_client_resources" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_client_resource_resource_id_index" ON "auth_oauth_client_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_oauth_client_resource_client_id_resource_id_unique_index" ON "auth_oauth_client_resources" USING btree ("client_id","resource_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_client_user_id_index" ON "auth_oauth_clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_consent_client_id_index" ON "auth_oauth_consents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_consent_user_id_index" ON "auth_oauth_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_refresh_token_client_id_index" ON "auth_oauth_refresh_tokens" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_refresh_token_session_id_index" ON "auth_oauth_refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_refresh_token_user_id_index" ON "auth_oauth_refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_oauth_refresh_token_authorization_code_id_index" ON "auth_oauth_refresh_tokens" USING btree ("authorization_code_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_id_index" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verification_identifier_index" ON "auth_verifications" USING btree ("identifier");