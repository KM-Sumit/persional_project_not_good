ALTER TABLE "test_sets" ADD COLUMN "access" "test_access" DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "test_sets" ADD COLUMN "price_inr" integer;--> statement-breakpoint
ALTER TABLE "test_sets" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "set_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_set_id_test_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."test_sets"("id") ON DELETE cascade ON UPDATE no action;
