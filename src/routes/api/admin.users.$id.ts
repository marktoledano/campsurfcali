import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { getSessionUser, toPublicUser } from "../../../lib/auth.js";

/**
 *   PATCH  /api/admin/users/:id  { isAdmin } -> promote/demote (admin only)
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
        if (typeof body.isAdmin !== "boolean")
          return Response.json({ error: "isAdmin (boolean) is required" }, { status: 400 });
        if (id === me.id && body.isAdmin === false)
          return Response.json({ error: "you cannot remove your own admin access" }, { status: 400 });

        const [updated] = await db
          .update(users)
          .set({ isAdmin: body.isAdmin })
          .where(eq(users.id, id))
          .returning();
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
