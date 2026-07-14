import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { getSessionUser, toPublicUser, updateUserEmail } from "../../../lib/auth.js";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 *   PATCH  /api/admin/users/:id  { isAdmin?, email? } -> promote/demote and/or change email (admin only)
 *   DELETE /api/admin/users/:id  -> remove an account and its trackers (admin only)
 */
export const Route = createFileRoute("/api/admin/users/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const me = await getSessionUser(request);
        if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!me.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

        const id = Number(params.id);
        if (Number.isNaN(id)) return Response.json({ error: "invalid id" }, { status: 400 });

        const body: any = await request.json().catch(() => ({}));
        const hasIsAdmin = typeof body.isAdmin === "boolean";
        const hasEmail = typeof body.email !== "undefined";
        if (!hasIsAdmin && !hasEmail) {
          return Response.json({ error: "isAdmin or email is required" }, { status: 400 });
        }
        if (hasIsAdmin && id === me.id && body.isAdmin === false) {
          return Response.json({ error: "you cannot remove your own admin access" }, { status: 400 });
        }

        let email: string | undefined;
        if (hasEmail) {
          email = String(body.email).trim().toLowerCase();
          if (!EMAIL_RE.test(email)) {
            return Response.json({ error: "a valid email is required" }, { status: 400 });
          }
        }

        if (hasIsAdmin) {
          const [existing] = await db.select().from(users).where(eq(users.id, id));
          if (!existing) return Response.json({ error: "not found" }, { status: 404 });
          await db.update(users).set({ isAdmin: body.isAdmin }).where(eq(users.id, id));
        }
        const updated = email
          ? await updateUserEmail(id, email)
          : (await db.select().from(users).where(eq(users.id, id)))[0];
        if (!updated) return Response.json({ error: "not found" }, { status: 404 });
        return Response.json({ user: toPublicUser(updated) });
      },

      DELETE: async ({ request, params }) => {
        const me = await getSessionUser(request);
        if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!me.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

        const id = Number(params.id);
        if (Number.isNaN(id)) return Response.json({ error: "invalid id" }, { status: 400 });
        if (id === me.id)
          return Response.json({ error: "you cannot delete your own account" }, { status: 400 });

        await db.delete(users).where(eq(users.id, id));
        return new Response(null, { status: 204 });
      },
    },
  },
});
