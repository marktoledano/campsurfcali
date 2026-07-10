import { createFileRoute } from "@tanstack/react-router";
import { searchParks, getFacilities } from "../../../lib/reserve-california.js";

/**
 * Search helper backing the "add a watch" flow.
 *   GET /api/search?park=big sur        -> matching parks
 *   GET /api/search?placeId=690&start=2026-08-01 -> campgrounds in a park
 */
export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const placeId = url.searchParams.get("placeId");
        const start = url.searchParams.get("start");

        try {
          if (placeId) {
            const facilities = await getFacilities(
              Number(placeId),
              start || defaultStartDate(),
            );
            return Response.json({ facilities });
          }

          const park = url.searchParams.get("park")?.trim();
          if (!park || park.length < 2) {
            return Response.json({ parks: [] });
          }
          const parks = await searchParks(park);
          return Response.json({ parks });
        } catch (err) {
          console.error("search error:", err);
          return Response.json(
            { error: "ReserveCalifornia search is temporarily unavailable." },
            { status: 502 },
          );
        }
      },
    },
  },
});

function defaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
