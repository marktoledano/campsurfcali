import { createFileRoute } from "@tanstack/react-router";
import { count, eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users, watches } from "../../../db/schema.js";
import { getSessionUser } from "../../../lib/auth.js";

/**
 *   GET /api/admin/users -> every account, with email + tracker count (admin only)
 */
export const Route = createFileRoute("/api/admin/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const me = await getSessionUser(request);
        if (!me) return Response.json({ error: "unauthorized" }, { status: 401 });
        if (!me.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

        const rows = await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            isAdmin: users.isAdmin,
            createdAt: users.createdAt,
            trackerCount: count(watches.id),
          })
          .from(users)
          .leftJoin(watches, eq(watches.userId, users.id))
          .groupBy(users.id)
          .orderBy(users.username);

        return Response.json({ users: rows });
      },
    },
  },
});
