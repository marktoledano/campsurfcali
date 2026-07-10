import type { GridUnit } from "./reserve-california.js";
import type { AvailableUnit, Watch } from "../db/schema.js";

/** Sort ISO date strings and return the length of the longest consecutive run. */
function longestConsecutiveRun(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...dates].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00Z");
    const cur = new Date(sorted[i] + "T00:00:00Z");
    const diffDays = (cur.getTime() - prev.getTime()) / 86_400_000;
    if (diffDays === 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Given the raw grid units for a campground and a watch's criteria, return the
 * units that satisfy the watch: matching the ADA/name filters and offering at
 * least `minNights` consecutive free nights inside the window.
 */
export function matchUnits(units: GridUnit[], watch: Watch): AvailableUnit[] {
  const filter = watch.siteFilter?.trim().toLowerCase();
  const result: AvailableUnit[] = [];

  for (const unit of units) {
    if (watch.adaOnly && !unit.isAda) continue;
    if (filter && !unit.unitName.toLowerCase().includes(filter)) continue;

    const freeDates = Object.entries(unit.nights)
      .filter(([, free]) => free)
      .map(([date]) => date)
      .sort();

    if (freeDates.length === 0) continue;
    if (longestConsecutiveRun(freeDates) < watch.minNights) continue;

    result.push({
      unitId: unit.unitId,
      unitName: unit.unitName,
      dates: freeDates,
    });
  }

  return result;
}
