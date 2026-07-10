import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches } from "../../../db/schema.js";
import { pollWatch } from "../../../lib/poll.js";

/**
 * On-demand poll for a single watch, so users can check "right now" instead of
 * waiting for the 5-minute scheduled sweep.
 *   POST /api/poll  { "watchId": 12 }
 */
export const Route = createFileRoute("/api/poll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const watchId = Number(body?.watchId);
        if (Number.isNaN(watchId))
          return Response.json({ error: "watchId is required" }, { status: 400 });

        const [watch] = await db
          .select()
          .from(watches)
          .where(eq(watches.id, watchId));
        if (!watch)
          return Response.json({ error: "watch not found" }, { status: 404 });

        const summary = await pollWatch(watch);
        const [refreshed] = await db
          .select()
          .from(watches)
          .where(eq(watches.id, watchId));
        return Response.json({ summary, watch: refreshed });
      },
    },
  },
});
