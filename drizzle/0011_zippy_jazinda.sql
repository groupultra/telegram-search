ALTER TABLE "stickers" ALTER COLUMN "file_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "stickers" ADD COLUMN "sticker_bytes" "bytea";--> statement-breakpoint
ALTER TABLE "stickers" ADD COLUMN "sticker_path" text NOT NULL;--> statement-breakpoint
ALTER TABLE "stickers" DROP COLUMN "image_base64";--> statement-breakpoint
ALTER TABLE "stickers" DROP COLUMN "image_path";--> statement-breakpoint
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_file_id_unique" UNIQUE("file_id");