import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches, type NewWatch, type DateRange } from "../../../db/schema.js";
import { getSessionUser } from "../../../lib/auth.js";

const MIN_CHECK_FREQUENCY_MINUTES = 5;

/**
 *   GET   /api/watches           -> the logged-in user's watches (newest first)
 *   POST  /api/watches           -> create a watch for the logged-in user
 *   PATCH /api/watches           { checkFrequencyMinutes } -> bulk-apply to every one of the user's watches
 */
export const Route = createFileRoute("/api/watches")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const rows = await db
          .select()
          .from(watches)
          .where(eq(watches.userId, user.id))
          .orderBy(desc(watches.createdAt));
        return Response.json({ watches: rows });
      },

      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

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
          userId: user.id,
          email: user.email,
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
          checkFrequencyMinutes: clampFrequency(body.checkFrequencyMinutes),
        };

        const [created] = await db.insert(watches).values(values).returning();
        return Response.json({ watch: created }, { status: 201 });
      },

      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const body: any = await request.json().catch(() => ({}));
        const minutes = Number(body.checkFrequencyMinutes);
        if (!Number.isFinite(minutes) || minutes < MIN_CHECK_FREQUENCY_MINUTES) {
          return Response.json(
            { error: `checkFrequencyMinutes must be at least ${MIN_CHECK_FREQUENCY_MINUTES}` },
            { status: 400 },
          );
        }

        await db
          .update(watches)
          .set({ checkFrequencyMinutes: Math.floor(minutes) })
          .where(eq(watches.userId, user.id));

        const rows = await db
          .select()
          .from(watches)
          .where(eq(watches.userId, user.id))
          .orderBy(desc(watches.createdAt));
        return Response.json({ watches: rows });
      },
    },
  },
});

function clampFrequency(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return MIN_CHECK_FREQUENCY_MINUTES;
  return Math.max(MIN_CHECK_FREQUENCY_MINUTES, Math.floor(n));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validate(body: any): string[] {
  const errors: string[] = [];
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
