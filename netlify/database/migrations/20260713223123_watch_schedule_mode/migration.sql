ALTER TABLE "watches" ADD COLUMN "schedule_mode" text DEFAULT 'interval' NOT NULL;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "daily_check_time" text;--> statement-breakpoint
ALTER TABLE "watches" ADD COLUMN "last_daily_check_date" text;