import type { DateRange } from "../db/schema.js";

/**
 * How many weekly occurrences a recurring watch looks ahead. Fixed (not
 * user-configurable): ReserveCalifornia's real booking horizon is ~180 days
 * (confirmed by live probing — results go empty, not erroring, past ~210
 * days), and each additional week costs one more upstream request per poll,
 * so 8 weeks keeps a single watch's poll fast while covering a realistic
 * planning window.
 */
export const RECURRING_HORIZON_WEEKS = 8;

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Expand a weekly recurrence rule into concrete date ranges, anchored to
 * `now`. Calling this fresh on every poll (rather than persisting a
 * one-time expansion) is what makes the watch "never go stale" — the
 * window always slides forward with the calendar instead of running out.
 */
export function expandRecurringRanges(
  startDay: number,
  nights: number,
  now: Date,
  horizonWeeks: number = RECURRING_HORIZON_WEEKS,
): DateRange[] {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const offset = (startDay - today.getUTCDay() + 7) % 7;
  const ranges: DateRange[] = [];
  for (let week = 0; week < horizonWeeks; week++) {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() + offset + week * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + nights);
    ranges.push({ startDate: toISODate(start), endDate: toISODate(end) });
  }
  return ranges;
}

/** Shared validation for the recurring-mode fields on both watch routes. */
export function parseRecurrence(
  body: any,
): { recurringStartDay: number; recurringNights: number } | { error: string } {
  const day = Number(body?.recurringStartDay);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return { error: "recurringStartDay must be an integer 0-6 (Sun-Sat)" };
  }
  const nights = Number(body?.recurringNights);
  if (!Number.isInteger(nights) || nights < 1 || nights > 14) {
    return { error: "recurringNights must be an integer between 1 and 14" };
  }
  return { recurringStartDay: day, recurringNights: nights };
}
