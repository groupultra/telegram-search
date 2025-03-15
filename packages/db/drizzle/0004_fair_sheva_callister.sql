CREATE TABLE "embedding_models" (
	"id" text PRIMARY KEY NOT NULL,
	"model_name" text NOT NULL,
	"vector_dimensions" integer NOT NULL,
	"create_at" timestamp DEFAULT now() NOT NULL,
	"update_at" timestamp DEFAULT now() NOT NULL
);
