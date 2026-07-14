ALTER TABLE "users" ADD COLUMN "notify_immediate" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_daily_digest" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_daily_sites" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "daily_sites_time" text DEFAULT '16:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_digest_sent_date" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_daily_sites_sent_date" text;