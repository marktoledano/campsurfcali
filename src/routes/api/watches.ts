import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches, type NewWatch, type DateRange } from "../../../db/schema.js";

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
          dateRanges: (body.dateRanges as any[]).map((r) => ({
            startDate: String(r.startDate),
            endDate: String(r.endDate),
          })),
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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: any): string[] {
  const errors: string[] = [];
  if (!body?.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(body.email)))
    errors.push("a valid email is required");
  if (!body?.facilityId || Number.isNaN(Number(body.facilityId)))
    errors.push("facilityId is required");
  if (!body?.placeId || Number.isNaN(Number(body.placeId)))
    errors.push("placeId is required");

  if (!Array.isArray(body?.dateRanges) || body.dateRanges.length === 0) {
    errors.push("at least one date range is required");
    return errors;
  }
  (body.dateRanges as DateRange[]).forEach((r, i) => {
    if (!r?.startDate || !ISO_DATE.test(String(r.startDate)))
      errors.push(`date range ${i + 1}: startDate must be YYYY-MM-DD`);
    if (!r?.endDate || !ISO_DATE.test(String(r.endDate)))
      errors.push(`date range ${i + 1}: endDate must be YYYY-MM-DD`);
    if (r?.startDate && r?.endDate && String(r.endDate) <= String(r.startDate))
      errors.push(`date range ${i + 1}: endDate must be after startDate`);
  });
  return errors;
}
