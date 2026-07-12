import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser, toPublicUser } from "../../../lib/auth.js";

/**
 *   GET /api/auth/me -> the logged-in user, or { user: null } if not authenticated
 */
export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request);
        return Response.json({ user: user ? toPublicUser(user) : null });
      },
    },
  },
});
