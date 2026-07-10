import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches, type NewWatch } from "../../../db/schema.js";

/**
 *   GET  /api/watches?email=...  -> that user's watches (newest first)
 *   POST /api/watches            -> create a watch
 */
export const Route = createFileRoute("/api/watches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const email = new URL(request.url).searchParams.get("email")?.trim();
        if (!email) {
          return Response.json({ error: "email is required" }, { status: 400 });
        }
        const rows = await db
          .select()
          .from(watches)
          .where(eq(watches.email, email))
          .orderBy(desc(watches.createdAt));
        return Response.json({ watches: rows });
      },

      POST: async ({ request }) => {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid JSON" }, { status: 400 });
        }

        const errors = validate(body);
        if (errors.length) {
          return Response.json({ error: errors.join("; ") }, { status: 400 });
        }

        const values: NewWatch = {
          email: String(body.email).trim().toLowerCase(),
          parkName: String(body.parkName),
          facilityName: String(body.facilityName),
          placeId: Number(body.placeId),
          facilityId: Number(body.facilityId),
          startDate: String(body.startDate),
          endDate: String(body.endDate),
          minNights: Math.max(1, Number(body.minNights) || 1),
          siteFilter: body.siteFilter ? String(body.siteFilter).trim() : null,
          adaOnly: Boolean(body.adaOnly),
          autoBook: Boolean(body.autoBook),
        };

        const [created] = await db.insert(watches).values(values).returning();
        return Response.json({ watch: created }, { status: 201 });
      },
    },
  },
});

function validate(body: any): string[] {
  const errors: string[] = [];
  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email)))
    errors.push("a valid email is required");
  if (!body?.facilityId || Number.isNaN(Number(body.facilityId)))
    errors.push("facilityId is required");
  if (!body?.placeId || Number.isNaN(Number(body.placeId)))
    errors.push("placeId is required");
  if (!body?.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.startDate)))
    errors.push("startDate must be YYYY-MM-DD");
  if (!body?.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.endDate)))
    errors.push("endDate must be YYYY-MM-DD");
  if (
    body?.startDate &&
    body?.endDate &&
    String(body.endDate) <= String(body.startDate)
  )
    errors.push("endDate must be after startDate");
  return errors;
}
