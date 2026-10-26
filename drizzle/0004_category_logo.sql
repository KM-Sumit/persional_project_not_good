ALTER TABLE "exam_categories" ADD COLUMN "logo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "exam_categories" ADD CONSTRAINT "exam_categories_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
