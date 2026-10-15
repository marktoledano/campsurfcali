ALTER TABLE "watches" ADD COLUMN "date_mode" text DEFAULT 'fixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "recurring_start_day" integer;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "recurring_nights" integer;