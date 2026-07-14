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
 * A registered account. Trackers ("watches") belong to a user; login is by
 * username + password, notifications go to the account's email.
 */
export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: text().notNull().unique(),
  email: text().notNull(),
  // PBKDF2-SHA256, formatted "pbkdf2:<iterations>:<saltHex>:<hashHex>". See lib/auth.ts.
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").notNull().default(false),
  // Email alert as soon as a watch's newly-open sites are recorded (per event).
  notifyImmediate: boolean("notify_immediate").notNull().default(true),
  // One daily recap email of everything that newly opened in roughly the last 24h.
  // Sent at a fixed time (see lib/reports.ts's DAILY_DIGEST_TIME_UTC) — not user-configurable.
  notifyDailyDigest: boolean("notify_daily_digest").notNull().default(false),
  // One daily email listing every currently-open site across all active trackers,
  // regardless of when it opened — same content as the "send availability now" button.
  notifyDailySites: boolean("notify_daily_sites").notNull().default(false),
  // Time of day (UTC, "HH:MM" 24-hour) the daily sites email should send. Default
  // is 8am US Pacific Standard Time (UTC-8).
  dailySitesTime: text("daily_sites_time").notNull().default("16:00"),
  // UTC date ("YYYY-MM-DD") bookkeeping so the 5-minute cron doesn't resend either
  // daily email more than once per day — mirrors watches.lastDailyCheckDate.
  lastDigestSentDate: text("last_digest_sent_date"),
  lastDailySitesSentDate: text("last_daily_sites_sent_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * A logged-in session, referenced by an opaque token stored in an HttpOnly
 * cookie (see lib/auth.ts). Deleting the row logs the session out.
 */
export const sessions = pgTable("sessions", {
  token: text().primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/**
 * A "watch" is a standing request by a user to be told when a campground has
 * open sites for a set of nights. The scheduled poller iterates active watches.
 */
export const watches = pgTable("watches", {
  id: serial().primaryKey(),
  // Owning account. `email` is kept denormalized from the account for
  // notify.ts (and as a historical record if the account's email changes).
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  email: text().notNull(),
  // Display + deep-link metadata resolved from the ReserveCalifornia API.
  parkName: text("park_name").notNull(),
  facilityName: text("facility_name").notNull(),
  placeId: integer("place_id").notNull(),
  facilityId: integer("facility_id").notNull(),
  // The park's official info page (usually parks.ca.gov), when available.
  // ReserveCalifornia doesn't expose a per-campsite map; this is the closest
  // real "map" reference — null when the API didn't provide one.
  parkUrl: text("park_url"),
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
  // How often the poller should re-check this watch, in minutes (floor of 5,
  // matching the Worker's own */5 cron cadence — see wrangler.toml). Only
  // used when scheduleMode is "interval".
  checkFrequencyMinutes: integer("check_frequency_minutes").notNull().default(5),
  // "interval" checks every checkFrequencyMinutes since the last check;
  // "daily" checks once per day at dailyCheckTime instead.
  scheduleMode: text("schedule_mode").notNull().default("interval"),
  // Time of day (UTC, "HH:MM" 24-hour) the daily check should run. Only set
  // when scheduleMode is "daily".
  dailyCheckTime: text("daily_check_time"),
  // UTC date ("YYYY-MM-DD") the daily check last ran, so a watch isn't
  // rechecked again until the next day even though the cron polls every 5 min.
  lastDailyCheckDate: text("last_daily_check_date"),
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
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
