import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { matches, watches } from "../../../db/schema.js";

/**
 * The notification feed: every detected availability event for a user's
 * watches, newest first.
 *   GET /api/matches?email=...
 */
export const Route = createFileRoute("/api/matches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const email = new URL(request.url).searchParams.get("email")?.trim();
        if (!email)
          return Response.json({ error: "email is required" }, { status: 400 });

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
          .where(eq(watches.email, email))
          .orderBy(desc(matches.createdAt))
          .limit(100);

        return Response.json({ matches: rows });
      },
    },
  },
});
