ALTER TABLE "photos" DROP CONSTRAINT "photos_file_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "photos_platform_file_id_unique_index" ON "photos" USING btree ("platform","file_id");
