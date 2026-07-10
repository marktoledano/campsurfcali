import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { watches, matches, type Watch } from "../db/schema.js";
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
 * Poll a single watch against ReserveCalifornia, persist the current
 * availability, and record + notify any newly-opened sites.
 */
export async function pollWatch(watch: Watch): Promise<PollSummary> {
  const url = bookingUrl(watch.placeId, watch.facilityId);
  try {
    const grid = await getGrid(watch.facilityId, watch.startDate, watch.endDate);
    const available = matchUnits(grid.units, watch);

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
        lastCheckedAt: new Date(),
        lastResult: available.length > 0 ? "available" : "unavailable",
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
      .set({ lastCheckedAt: new Date(), lastResult: "error" })
      .where(eq(watches.id, watch.id));
    return {
      watchId: watch.id,
      availableCount: watch.availableCount,
      newlyOpen: 0,
      result: "error",
    };
  }
}

/** Poll every active watch, spacing requests out to stay a polite client. */
export async function pollAllWatches(): Promise<PollSummary[]> {
  const active = await db.select().from(watches).where(eq(watches.active, true));
  const summaries: PollSummary[] = [];
  for (const watch of active) {
    summaries.push(await pollWatch(watch));
    // ~1 request/second to ReserveCalifornia.
    await new Promise((r) => setTimeout(r, 1100));
  }
  return summaries;
}
