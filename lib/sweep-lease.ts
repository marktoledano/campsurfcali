import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { sweepLease } from "../db/schema.js";

// 2x the cron interval (see wrangler.toml's [triggers]) — long enough that a
// normal sweep never gets treated as abandoned, short enough that a
// genuinely-hung sweep self-heals within a couple of ticks instead of
// deadlocking the poller forever.
const STALE_AFTER_MS = 4 * 60 * 1000;

/**
 * Try to acquire the singleton sweep lease so two overlapping cron ticks
 * can't run pollAllWatches concurrently. Returns true if this invocation now
 * owns the lease (the caller must call releaseSweepLease() when done, even
 * on error), false if another sweep already holds a fresh one.
 */
export async function acquireSweepLease(): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS);
  const acquired = await db
    .update(sweepLease)
    .set({ lockedAt: new Date() })
    .where(
      and(
        eq(sweepLease.id, 1),
        or(isNull(sweepLease.lockedAt), lt(sweepLease.lockedAt, staleBefore)),
      ),
    )
    .returning({ id: sweepLease.id });
  return acquired.length > 0;
}

/** Release the sweep lease so the next tick can acquire it immediately. */
export async function releaseSweepLease(): Promise<void> {
  await db.update(sweepLease).set({ lockedAt: null }).where(eq(sweepLease.id, 1));
}
