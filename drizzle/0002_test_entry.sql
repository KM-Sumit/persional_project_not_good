ALTER TABLE "tests" ADD COLUMN "join_code" text;
ALTER TABLE "tests" ADD COLUMN "chapter_id" uuid;
ALTER TABLE "tests" ADD CONSTRAINT "tests_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "tests_join_code_unique" ON "tests" USING btree ("join_code");
CREATE INDEX "tests_chapter_idx" ON "tests" USING btree ("chapter_id");
