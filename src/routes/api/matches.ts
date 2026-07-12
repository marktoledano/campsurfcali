import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { matches, watches } from "../../../db/schema.js";
import { getSessionUser } from "../../../lib/auth.js";

/**
 * The notification feed: every detected availability event for the
 * logged-in user's watches, newest first.
 *   GET /api/matches
 */
export const Route = createFileRoute("/api/matches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const rows = await db
          .select({
            id: matches.id,
            unitName: matches.unitName,
            dates: matches.dates,
            bookingUrl: matches.bookingUrl,
            autoBook: matches.autoBook,
            notifyChannel: matches.notifyChannel,
            createdAt: matches.createdAt,
            parkName: watches.parkName,
            facilityName: watches.facilityName,
          })
          .from(matches)
          .innerJoin(watches, eq(matches.watchId, watches.id))
          .where(eq(watches.userId, user.id))
          .orderBy(desc(matches.createdAt))
          .limit(100);

        return Response.json({ matches: rows });
      },
    },
  },
});
