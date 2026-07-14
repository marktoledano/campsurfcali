import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { getSessionUser, toPublicUser } from "../../../lib/auth.js";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 *   PATCH /api/auth/preferences  { notifyImmediate?, notifyDailyDigest?, notifyDailySites?, dailySitesTime? }
 *   -> update the logged-in user's notification preferences
 */
export const Route = createFileRoute("/api/auth/preferences")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const body: any = await request.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};

        if (typeof body.notifyImmediate === "boolean") patch.notifyImmediate = body.notifyImmediate;
        if (typeof body.notifyDailyDigest === "boolean") patch.notifyDailyDigest = body.notifyDailyDigest;
        if (typeof body.notifyDailySites === "boolean") patch.notifyDailySites = body.notifyDailySites;

        if (typeof body.dailySitesTime !== "undefined") {
          const time = String(body.dailySitesTime);
          if (!TIME_RE.test(time)) {
            return Response.json({ error: "dailySitesTime must be a 24-hour HH:MM time" }, { status: 400 });
          }
          patch.dailySitesTime = time;
          // Time changed — let today re-evaluate against the new schedule.
          patch.lastDailySitesSentDate = null;
        }

        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "nothing to update" }, { status: 400 });
        }

        const [updated] = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
        return Response.json({ user: toPublicUser(updated) });
      },
    },
  },
});
