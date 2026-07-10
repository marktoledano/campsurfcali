import type { Config } from "@netlify/functions";
import { pollAllWatches } from "../../lib/poll.js";

/**
 * Scheduled poller. Every 5 minutes it checks all active watches against the
 * ReserveCalifornia availability API and records + notifies any newly-open
 * campsites. Scheduled functions run only on published production deploys.
 */
export default async (req: Request) => {
  const summaries = await pollAllWatches();
  const opened = summaries.reduce((n, s) => n + s.newlyOpen, 0);
  console.log(
    `Polled ${summaries.length} watches; ${opened} newly-open site group(s).`,
  );
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
