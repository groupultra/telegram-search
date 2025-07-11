ALTER TABLE "stickers" DROP CONSTRAINT "stickers_file_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "stickers_platform_file_id_unique" ON "stickers" USING btree ("platform","file_id");