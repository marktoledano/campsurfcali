import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { watches, matches, users, type Watch, type AvailableUnit, type DateRange } from "../db/schema.js";
import { getGrid, bookingUrl, type GridResult } from "./reserve-california.js";
import { matchUnits } from "./matcher.js";
import { sendAlert } from "./notify.js";
import { expandRecurringRanges } from "./recurrence.js";

export type PollSummary = {
  watchId: number;
  availableCount: number;
  newlyOpen: number;
  result: "available" | "unavailable" | "error";
};

type GridFetcher = (facilityId: number, startDate: string, endDate: string) => Promise<GridResult>;
type CacheCheck = (facilityId: number, startDate: string, endDate: string) => boolean;

function gridCacheKey(facilityId: number, startDate: string, endDate: string): string {
  return `${facilityId}|${startDate}|${endDate}`;
}

/**
 * Per-sweep cache so N watches (or N date ranges) pointed at the exact same
 * facility+date-range only trigger one upstream request. The in-flight
 * Promise itself is cached (not just the resolved value) so concurrent
 * pollers racing on the same key still only issue one fetch — Map access is
 * synchronous, so whichever caller reaches `fetch` first wins the slot.
 */
export function createGridCache(): { fetch: GridFetcher; wasCached: CacheCheck } {
  const cache = new Map<string, Promise<GridResult>>();
  return {
    fetch(facilityId, startDate, endDate) {
      const key = gridCacheKey(facilityId, startDate, endDate);
      let entry = cache.get(key);
      if (!entry) {
        entry = getGrid(facilityId, startDate, endDate);
        cache.set(key, entry);
      }
      return entry;
    },
    wasCached(facilityId, startDate, endDate) {
      return cache.has(gridCacheKey(facilityId, startDate, endDate));
    },
  };
}

/**
 * Poll every one of a watch's date ranges and merge the results into a single
 * per-unit availability list, unioning the free dates when the same unit
 * shows up open in more than one range.
 */
async function pollDateRanges(
  watch: Watch,
  dateRanges: DateRange[],
  fetchGrid: GridFetcher,
  wasCached: CacheCheck,
): Promise<AvailableUnit[]> {
  const byUnit = new Map<number, AvailableUnit>();
  for (const [i, range] of dateRanges.entries()) {
    // ~1 request/second to ReserveCalifornia, but only when this range is
    // actually going to hit the network — a range already served by the
    // sweep's grid cache (see createGridCache) costs nothing to skip ahead of.
    if (i > 0 && !wasCached(watch.facilityId, range.startDate, range.endDate)) {
      await new Promise((r) => setTimeout(r, 1100));
    }
    const grid = await fetchGrid(watch.facilityId, range.startDate, range.endDate);
    for (const unit of matchUnits(grid.units, watch)) {
      const existing = byUnit.get(unit.unitId);
      if (existing) {
        existing.dates = [...new Set([...existing.dates, ...unit.dates])].sort();
      } else {
        byUnit.set(unit.unitId, { ...unit, dates: [...unit.dates] });
      }
    }
  }
  return [...byUnit.values()];
}

/**
 * Poll a single watch against ReserveCalifornia, persist the current
 * availability, and record + notify any newly-opened sites.
 *
 * `now` is passed in rather than captured fresh here so every watch in a
 * sweep is stamped with the sweep's own start time, not a time that has
 * drifted later by however long this watch waited in the queue — see
 * `pollAllWatches`. Stamping a drifted time would make the *next* sweep's
 * due-check (`isDue`) compare against a `now` that's already past
 * `lastCheckedAt + checkFrequencyMinutes`, silently skipping this watch an
 * extra tick.
 */
export async function pollWatch(
  watch: Watch,
  now: Date,
  fetchGrid: GridFetcher,
  wasCached: CacheCheck,
  notifyImmediate: boolean,
): Promise<PollSummary> {
  const url = bookingUrl(watch.placeId, watch.facilityId);
  // For a "daily" watch, a poll (successful or not) satisfies that day's check
  // so the cron's sweeps don't re-trigger it again until tomorrow.
  const dailyBookkeeping =
    watch.scheduleMode === "daily" ? { lastDailyCheckDate: todayUTC(now) } : {};
  // A recurring watch's dateRanges are re-derived from "now" on every poll
  // instead of being read as a stored, finite list — this is what keeps it
  // from ever going stale. See lib/recurrence.ts.
  const effectiveRanges =
    watch.dateMode === "recurring"
      ? expandRecurringRanges(watch.recurringStartDay!, watch.recurringNights!, now)
      : watch.dateRanges;
  const recurringBookkeeping = watch.dateMode === "recurring" ? { dateRanges: effectiveRanges } : {};
  try {
    const available = await pollDateRanges(watch, effectiveRanges, fetchGrid, wasCached);

    // A specific (unit, date) pair not open on the previous poll is "newly
    // open" and worth an alert. Keying on the date as well as the unit (not
    // just the unit) matters most for recurring watches, where the same
    // physical site number recurs week after week — comparing by unitId
    // alone would permanently suppress alerts for every week after the
    // first one a site was ever seen open.
    const previousKeys = new Set(
      (watch.currentAvailability ?? []).flatMap((u) => u.dates.map((d) => `${u.unitId}:${d}`)),
    );
    const newlyOpen = available
      .map((u) => ({ ...u, dates: u.dates.filter((d) => !previousKeys.has(`${u.unitId}:${d}`)) }))
      .filter((u) => u.dates.length > 0);

    if (newlyOpen.length > 0) {
      // Attempt notification *before* committing the availability snapshot
      // below. If this throws (a transient DB or email hiccup), we fall
      // through to the snapshot commit anyway rather than letting the
      // failure prevent it — the snapshot commit is what marks these units
      // "seen", and doing that before a successful alert would permanently
      // erase the opening from future detection. Worst case on a genuine
      // failure here is a duplicate alert next sweep, not a silently lost one.
      try {
        const outcome = await sendAlert({ watch, units: newlyOpen, bookingUrl: url, notifyImmediate });
        await db.insert(matches).values(
          newlyOpen.map((u) => ({
            watchId: watch.id,
            unitId: u.unitId,
            unitName: u.unitName,
            dates: u.dates,
            bookingUrl: url,
            autoBook: watch.autoBook,
            notified: outcome.delivered,
            notifyChannel: outcome.channel,
          })),
        );
      } catch (err) {
        console.error(`Alert/match insert failed for watch ${watch.id}:`, err);
      }
    }

    await db
      .update(watches)
      .set({
        currentAvailability: available,
        availableCount: available.length,
        lastCheckedAt: now,
        lastResult: available.length > 0 ? "available" : "unavailable",
        ...dailyBookkeeping,
        ...recurringBookkeeping,
      })
      .where(eq(watches.id, watch.id));

    return {
      watchId: watch.id,
      availableCount: available.length,
      newlyOpen: newlyOpen.length,
      result: available.length > 0 ? "available" : "unavailable",
    };
  } catch (err) {
    console.error(`Failed to poll watch ${watch.id}:`, err);
    await db
      .update(watches)
      .set({ lastCheckedAt: now, lastResult: "error", ...dailyBookkeeping })
      .where(eq(watches.id, watch.id));
    return {
      watchId: watch.id,
      availableCount: watch.availableCount,
      newlyOpen: 0,
      result: "error",
    };
  }
}

function todayUTC(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * A watch is due once its own schedule says so: either its check-frequency
 * interval has elapsed since the last poll ("interval" mode), or today's
 * scheduled clock time (UTC) has arrived and hasn't been checked yet ("daily").
 */
function isDue(watch: Watch, now: Date): boolean {
  if (watch.scheduleMode === "daily") {
    if (!watch.dailyCheckTime) return true; // misconfigured; fail open
    const today = todayUTC(now);
    if (watch.lastDailyCheckDate === today) return false;
    const scheduled = new Date(`${today}T${watch.dailyCheckTime}:00Z`);
    return now.getTime() >= scheduled.getTime();
  }
  if (!watch.lastCheckedAt) return true;
  const dueAt = watch.lastCheckedAt.getTime() + watch.checkFrequencyMinutes * 60_000;
  return dueAt <= now.getTime();
}

const SWEEP_CONCURRENCY = 4;

/** Poll every active, due watch with a small bounded-concurrency worker pool. */
export async function pollAllWatches(): Promise<PollSummary[]> {
  const rows = await db
    .select({ watch: watches, notifyImmediate: users.notifyImmediate })
    .from(watches)
    .innerJoin(users, eq(watches.userId, users.id))
    .where(eq(watches.active, true));

  const now = new Date();
  const due = rows.filter((r) => isDue(r.watch, now));
  const { fetch: fetchGrid, wasCached } = createGridCache();

  const summaries: PollSummary[] = new Array(due.length);
  let next = 0;
  async function worker() {
    while (next < due.length) {
      const i = next++;
      const { watch, notifyImmediate } = due[i];
      summaries[i] = await pollWatch(watch, now, fetchGrid, wasCached, notifyImmediate);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(SWEEP_CONCURRENCY, due.length) }, worker),
  );
  return summaries;
}
