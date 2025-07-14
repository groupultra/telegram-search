ALTER TABLE "stickers" ALTER COLUMN "sticker_path" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_file_id_unique" UNIQUE("file_id");