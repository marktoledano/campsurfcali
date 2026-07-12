import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches, type DateRange } from "../../../db/schema.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 *   PATCH  /api/watches/:id  -> toggle active / autoBook, or edit the tracker's
 *                               date ranges / min nights / site filter / ADA flag
 *   DELETE /api/watches/:id  -> remove a watch (and its matches, via cascade)
 */
export const Route = createFileRoute("/api/watches/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return Response.json({ error: "invalid id" }, { status: 400 });

        const body: any = await request.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (typeof body.autoBook === "boolean") patch.autoBook = body.autoBook;
        if (typeof body.adaOnly === "boolean") patch.adaOnly = body.adaOnly;
        if (typeof body.siteFilter !== "undefined")
          patch.siteFilter = body.siteFilter
            ? String(body.siteFilter).trim()
            : null;

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

      DELETE: async ({ params }) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return Response.json({ error: "invalid id" }, { status: 400 });
        await db.delete(watches).where(eq(watches.id, id));
        return new Response(null, { status: 204 });
      },
    },
  },
});
