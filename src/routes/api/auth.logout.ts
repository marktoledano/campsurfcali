import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookieHeader, deleteSession, getSessionToken } from "../../../lib/auth.js";

/**
 *   POST /api/auth/logout -> end the current session
 */
export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = getSessionToken(request);
        if (token) await deleteSession(token);
        return new Response(null, {
          status: 204,
          headers: { "Set-Cookie": clearSessionCookieHeader(request) },
        });
      },
    },
  },
});
