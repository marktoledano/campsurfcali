import { createFileRoute } from "@tanstack/react-router";
import { getSessionUser, toPublicUser, updateUserEmail } from "../../../lib/auth.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 *   PATCH /api/auth/email  { email } -> update the logged-in user's email
 *   (cascades to every one of their watches, so alerts follow the new address)
 */
export const Route = createFileRoute("/api/auth/email")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const user = await getSessionUser(request);
        if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

        const body: any = await request.json().catch(() => ({}));
        const email = String(body.email ?? "").trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          return Response.json({ error: "a valid email is required" }, { status: 400 });
        }

        const updated = await updateUserEmail(user.id, email);
        return Response.json({ user: toPublicUser(updated) });
      },
    },
  },
});
