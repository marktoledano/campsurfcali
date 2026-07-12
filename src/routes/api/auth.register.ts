import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "../../../db/index.js";
import { users } from "../../../db/schema.js";
import { createSession, hashPassword, sessionCookieHeader, toPublicUser } from "../../../lib/auth.js";

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 *   POST /api/auth/register  { username, email, password, confirmPassword } -> create account + log in
 */
export const Route = createFileRoute("/api/auth/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body: any = await request.json().catch(() => ({}));
        const username = String(body.username ?? "").trim();
        const email = String(body.email ?? "").trim().toLowerCase();
        const password = String(body.password ?? "");
        const confirmPassword = String(body.confirmPassword ?? "");

        const errors: string[] = [];
        if (!USERNAME_RE.test(username))
          errors.push("username must be 3-32 characters (letters, numbers, _ . - only)");
        if (!EMAIL_RE.test(email)) errors.push("a valid email is required");
        if (password.length < 8) errors.push("password must be at least 8 characters");
        if (password !== confirmPassword) errors.push("passwords do not match");
        if (errors.length) return Response.json({ error: errors.join("; ") }, { status: 400 });

        const [existing] = await db.select().from(users).where(eq(users.username, username));
        if (existing) return Response.json({ error: "that username is already taken" }, { status: 409 });

        const passwordHash = await hashPassword(password);
        const [created] = await db
          .insert(users)
          .values({ username, email, passwordHash })
          .returning();

        const { token, expiresAt } = await createSession(created.id);
        return Response.json(
          { user: toPublicUser(created) },
          { status: 201, headers: { "Set-Cookie": sessionCookieHeader(request, token, expiresAt) } },
        );
      },
    },
  },
});
