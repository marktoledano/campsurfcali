import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * A single unit (campsite) that is currently open for one of the watch's date
 * ranges, as stored on the watch row so the dashboard can render status
 * without re-polling ReserveCalifornia.
 */
export type AvailableUnit = {
  unitId: number;
  unitName: string;
  /** ISO date strings (YYYY-MM-DD) that are free for this unit. */
  dates: string[];
};

/** One of a watch's (possibly several) desired stay windows. */
export type DateRange = {
  startDate: string;
  endDate: string;
};

/**
 * A "watch" is a standing request by a user to be told when a campground has
 * open sites for a set of nights. The scheduled poller iterates active watches.
 */
export const watches = pgTable("watches", {
  id: serial().primaryKey(),
  // Who to notify. Watches are keyed to an email address (no login required).
  email: text().notNull(),
  // Display + deep-link metadata resolved from the ReserveCalifornia API.
  parkName: text("park_name").notNull(),
  facilityName: text("facility_name").notNull(),
  placeId: integer("place_id").notNull(),
  facilityId: integer("facility_id").notNull(),
  // Desired stay windows. A watch can track several separate date ranges at
  // the same campground (e.g. two different weekends); the poller checks
  // each one independently and merges the results.
  dateRanges: jsonb("date_ranges").$type<DateRange[]>().notNull(),
  // Minimum number of consecutive free nights that counts as a match.
  minNights: integer("min_nights").notNull().default(1),
  // Optional case-insensitive substring filter on the campsite/unit name.
  siteFilter: text("site_filter"),
  // Only consider ADA-accessible units when true.
  adaOnly: boolean("ada_only").notNull().default(false),
  // When true, matches are flagged for one-click booking assistance.
  autoBook: boolean("auto_book").notNull().default(false),
  // Paused watches are skipped by the poller.
  active: boolean().notNull().default(true),
  // Poller bookkeeping.
  lastCheckedAt: timestamp("last_checked_at"),
  lastResult: text("last_result").notNull().default("pending"),
  availableCount: integer("available_count").notNull().default(0),
  currentAvailability: jsonb("current_availability")
    .$type<AvailableUnit[]>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * A detected availability event: a specific unit opened up for a watch. One row
 * is created the first time a given unit is seen open for a watch, and it drives
 * the notification feed and email alerts.
 */
export const matches = pgTable("matches", {
  id: serial().primaryKey(),
  watchId: integer("watch_id")
    .notNull()
    .references(() => watches.id, { onDelete: "cascade" }),
  unitId: integer("unit_id").notNull(),
  unitName: text("unit_name").notNull(),
  // ISO date strings that are free for this unit within the watch window.
  dates: jsonb().$type<string[]>().notNull().default([]),
  bookingUrl: text("booking_url").notNull(),
  autoBook: boolean("auto_book").notNull().default(false),
  // Notification delivery bookkeeping.
  notified: boolean().notNull().default(false),
  notifyChannel: text("notify_channel"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Watch = typeof watches.$inferSelect;
export type NewWatch = typeof watches.$inferInsert;
export type Match = typeof matches.$inferSelect;
