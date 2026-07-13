import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { watches, matches, type Watch, type AvailableUnit } from "../db/schema.js";
import { getGrid, bookingUrl } from "./reserve-california.js";
import { matchUnits } from "./matcher.js";
import { sendAlert } from "./notify.js";

export type PollSummary = {
  watchId: number;
  availableCount: number;
  newlyOpen: number;
  result: "available" | "unavailable" | "error";
};

/**
 * Poll every one of a watch's date ranges and merge the results into a single
 * per-unit availability list, unioning the free dates when the same unit
 * shows up open in more than one range.
 */
async function pollDateRanges(watch: Watch): Promise<AvailableUnit[]> {
  const byUnit = new Map<number, AvailableUnit>();
  for (const [i, range] of watch.dateRanges.entries()) {
    // ~1 request/second to ReserveCalifornia, including across a watch's own ranges.
    if (i > 0) await new Promise((r) => setTimeout(r, 1100));
    const grid = await getGrid(watch.facilityId, range.startDate, range.endDate);
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
 */
export async function pollWatch(watch: Watch): Promise<PollSummary> {
  const url = bookingUrl(watch.placeId, watch.facilityId);
  const now = new Date();
  // For a "daily" watch, a poll (successful or not) satisfies that day's check
  // so the cron's 5-minute sweeps don't re-trigger it again until tomorrow.
  const dailyBookkeeping =
    watch.scheduleMode === "daily" ? { lastDailyCheckDate: todayUTC(now) } : {};
  try {
    const available = await pollDateRanges(watch);

    // Units that were not open on the previous poll are "newly open" and worth
    // an alert. Comparing against the stored snapshot prevents repeat spam.
    const previousIds = new Set(
      (watch.currentAvailability ?? []).map((u) => u.unitId),
    );
    const newlyOpen = available.filter((u) => !previousIds.has(u.unitId));

    await db
      .update(watches)
      .set({
        currentAvailability: available,
        availableCount: available.length,
        lastCheckedAt: now,
        lastResult: available.length > 0 ? "available" : "unavailable",
        ...dailyBookkeeping,
      })
      .where(eq(watches.id, watch.id));

    if (newlyOpen.length > 0) {
      const channel = await sendAlert({ watch, units: newlyOpen, bookingUrl: url });
      await db.insert(matches).values(
        newlyOpen.map((u) => ({
          watchId: watch.id,
          unitId: u.unitId,
          unitName: u.unitName,
          dates: u.dates,
          bookingUrl: url,
          autoBook: watch.autoBook,
          notified: true,
          notifyChannel: channel,
        })),
      );
    }

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

/** Poll every active, due watch, spacing requests out to stay a polite client. */
export async function pollAllWatches(): Promise<PollSummary[]> {
  const active = await db.select().from(watches).where(eq(watches.active, true));
  const now = new Date();
  const due = active.filter((w) => isDue(w, now));
  const summaries: PollSummary[] = [];
  for (const watch of due) {
    summaries.push(await pollWatch(watch));
    // ~1 request/second to ReserveCalifornia.
    await new Promise((r) => setTimeout(r, 1100));
  }
  return summaries;
}
