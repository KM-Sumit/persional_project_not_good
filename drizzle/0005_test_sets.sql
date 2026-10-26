CREATE TABLE "test_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"exam_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "test_sets" ADD CONSTRAINT "test_sets_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD COLUMN "set_id" uuid;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_set_id_test_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."test_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tests_set_id_index" ON "tests" USING btree ("set_id");
