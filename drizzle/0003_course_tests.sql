ALTER TABLE "tests" ADD COLUMN "course_id" uuid;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tests_course_id_index" ON "tests" USING btree ("course_id");
