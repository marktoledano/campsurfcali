import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser } from "../../../lib/auth.js";
import { sendSitesReportNow } from "../../../lib/reports.js";

/**
 *   POST /api/notify/send-now -> email the logged-in user a report of every
 *   currently-open site across their active trackers, right now.
 */
export const Route = createFileRoute("/api/notify/send-now")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const sent = await sendSitesReportNow(user);
        if (!sent) {
          return Response.json(
            { error: "Couldn't send the email — check that Email Sending is configured for campsurfcali.com." },
            { status: 502 },
          );
        }
        return Response.json({ sent: true });
      },
    },
  },
});
