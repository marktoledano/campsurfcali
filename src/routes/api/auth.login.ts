import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { createSession, sessionCookieHeader, toPublicUser, verifyPassword } from "../../../lib/auth.js";

/**
 *   POST /api/auth/login  { username, password } -> log in
 */
export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body: any = await request.json().catch(() => ({}));
        const username = String(body.username ?? "").trim();
        const password = String(body.password ?? "");
        if (!username || !password)
          return Response.json({ error: "username and password are required" }, { status: 400 });

        const [user] = await db.select().from(users).where(eq(users.username, username));
        if (!user || !(await verifyPassword(password, user.passwordHash)))
          return Response.json({ error: "invalid username or password" }, { status: 401 });

        const { token, expiresAt } = await createSession(user.id);
        return Response.json(
          { user: toPublicUser(user) },
          { headers: { "Set-Cookie": sessionCookieHeader(request, token, expiresAt) } },
        );
      },
    },
  },
});
