CREATE TABLE "matches" (
	"id" serial PRIMARY KEY,
	"watch_id" integer NOT NULL,
	"unit_id" integer NOT NULL,
	"unit_name" text NOT NULL,
	"dates" jsonb DEFAULT '[]' NOT NULL,
	"booking_url" text NOT NULL,
	"auto_book" boolean DEFAULT false NOT NULL,
	"notified" boolean DEFAULT false NOT NULL,
	"notify_channel" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watches" (
	"id" serial PRIMARY KEY,
	"email" text NOT NULL,
	"park_name" text NOT NULL,
	"facility_name" text NOT NULL,
	"place_id" integer NOT NULL,
	"facility_id" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"min_nights" integer DEFAULT 1 NOT NULL,
	"site_filter" text,
	"ada_only" boolean DEFAULT false NOT NULL,
	"auto_book" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp,
	"last_result" text DEFAULT 'pending' NOT NULL,
	"available_count" integer DEFAULT 0 NOT NULL,
	"current_availability" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_watch_id_watches_id_fkey" FOREIGN KEY ("watch_id") REFERENCES "watches"("id") ON DELETE CASCADE;