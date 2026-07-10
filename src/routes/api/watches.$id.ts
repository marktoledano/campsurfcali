import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { watches } from "../../../db/schema.js";

/**
 *   PATCH  /api/watches/:id  -> toggle active / autoBook
 *   DELETE /api/watches/:id  -> remove a watch (and its matches, via cascade)
 */
export const Route = createFileRoute("/api/watches/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return Response.json({ error: "invalid id" }, { status: 400 });

        const body = await request.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};
        if (typeof body.active === "boolean") patch.active = body.active;
        if (typeof body.autoBook === "boolean") patch.autoBook = body.autoBook;
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
