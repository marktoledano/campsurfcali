import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches, type DateRange } from "../../../db/schema.js";
import { getSessionUser } from "../../../lib/auth.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_CHECK_FREQUENCY_MINUTES = 5;

/**
 *   PATCH  /api/watches/:id  -> toggle active / autoBook, edit the tracker's
 *                               date ranges / min nights / site filter / ADA
 *                               flag / check frequency (owner only)
 *   DELETE /api/watches/:id  -> remove a watch (and its matches, via cascade) (owner only)
 */
export const Route = createFileRoute("/api/watches/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const id = Number(params.id);
        if (Number.isNaN(id))
          return Response.json({ error: "invalid id" }, { status: 400 });

        const [existing] = await db.select().from(watches).where(eq(watches.id, id));
        if (!existing) return Response.json({ error: "not found" }, { status: 404 });
        if (existing.userId !== user.id)
          return Response.json({ error: "forbidden" }, { status: 403 });

        const body: any = await request.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (typeof body.autoBook === "boolean") patch.autoBook = body.autoBook;
        if (typeof body.adaOnly === "boolean") patch.adaOnly = body.adaOnly;
        if (typeof body.siteFilter !== "undefined")
          patch.siteFilter = body.siteFilter
            ? String(body.siteFilter).trim()
            : null;

        if (typeof body.scheduleMode !== "undefined") {
          if (body.scheduleMode === "daily") {
            const time = String(body.dailyCheckTime ?? "");
            if (!TIME_RE.test(time))
              return Response.json(
                { error: "dailyCheckTime must be a 24-hour HH:MM time" },
                { status: 400 },
              );
            patch.scheduleMode = "daily";
            patch.dailyCheckTime = time;
            patch.lastDailyCheckDate = null;
          } else if (body.scheduleMode === "interval") {
            const n = Number(body.checkFrequencyMinutes);
            if (!Number.isFinite(n) || n < MIN_CHECK_FREQUENCY_MINUTES)
              return Response.json(
                { error: `checkFrequencyMinutes must be at least ${MIN_CHECK_FREQUENCY_MINUTES}` },
                { status: 400 },
              );
            patch.scheduleMode = "interval";
            patch.checkFrequencyMinutes = Math.floor(n);
            patch.dailyCheckTime = null;
            patch.lastDailyCheckDate = null;
          } else {
            return Response.json({ error: "scheduleMode must be 'interval' or 'daily'" }, { status: 400 });
          }
        } else if (typeof body.checkFrequencyMinutes !== "undefined") {
          const n = Number(body.checkFrequencyMinutes);
          if (!Number.isFinite(n) || n < MIN_CHECK_FREQUENCY_MINUTES)
            return Response.json(
              { error: `checkFrequencyMinutes must be at least ${MIN_CHECK_FREQUENCY_MINUTES}` },
              { status: 400 },
            );
          patch.checkFrequencyMinutes = Math.floor(n);
        }

        if (typeof body.minNights !== "undefined") {
          const n = Number(body.minNights);
          if (!Number.isFinite(n) || n < 1)
            return Response.json(
              { error: "minNights must be a positive number" },
              { status: 400 },
            );
          patch.minNights = Math.floor(n);
        }

        if (typeof body.dateRanges !== "undefined") {
          if (!Array.isArray(body.dateRanges) || body.dateRanges.length === 0)
            return Response.json(
              { error: "at least one date range is required" },
              { status: 400 },
            );
          const ranges: DateRange[] = [];
          for (const r of body.dateRanges as any[]) {
            if (
              !r?.startDate ||
              !ISO_DATE.test(String(r.startDate)) ||
              !r?.endDate ||
              !ISO_DATE.test(String(r.endDate))
            )
              return Response.json(
                { error: "each date range needs a valid startDate/endDate" },
                { status: 400 },
              );
            if (String(r.endDate) <= String(r.startDate))
              return Response.json(
                { error: "endDate must be after startDate for every range" },
                { status: 400 },
              );
            ranges.push({ startDate: String(r.startDate), endDate: String(r.endDate) });
          }
          patch.dateRanges = ranges;
        }

        if (Object.keys(patch).length === 0)
          return Response.json({ error: "nothing to update" }, { status: 400 });

        const [updated] = await db
          .update(watches)
          .set(patch)
          .where(eq(watches.id, id))
          .returning();
        if (!updated)
          return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ watch: updated });
      },

      DELETE: async ({ request, params }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const id = Number(params.id);
        if (Number.isNaN(id))
          return Response.json({ error: "invalid id" }, { status: 400 });

        const [existing] = await db.select().from(watches).where(eq(watches.id, id));
        if (!existing) return Response.json({ error: "not found" }, { status: 404 });
        if (existing.userId !== user.id)
          return Response.json({ error: "forbidden" }, { status: 403 });

        await db.delete(watches).where(and(eq(watches.id, id), eq(watches.userId, user.id)));
        return new Response(null, { status: 204 });
      },
    },
  },
});
