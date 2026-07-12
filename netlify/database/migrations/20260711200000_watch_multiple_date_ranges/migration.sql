ALTER TABLE "watches" ADD COLUMN "date_ranges" jsonb;
--> statement-breakpoint
UPDATE "watches" SET "date_ranges" = jsonb_build_array(jsonb_build_object('startDate', start_date, 'endDate', end_date));
--> statement-breakpoint
ALTER TABLE "watches" ALTER COLUMN "date_ranges" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "watches" DROP COLUMN "start_date";
--> statement-breakpoint
ALTER TABLE "watches" DROP COLUMN "end_date";
