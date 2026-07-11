import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema.js";
import { getCfEnv } from "../src/server/cf-env.js";

function createClient(url: string) {
  return drizzle({ client: neon(url), schema });
}

let cached: { url: string; client: ReturnType<typeof createClient> } | null = null;

// Cloudflare Workers bindings (including secrets) are request-scoped, not
// available via a global process.env — so the drizzle client can't be a
// top-level singleton like it was on Netlify. Instead this Proxy lazily
// resolves the real client from the AsyncLocalStorage-bridged env on every
// property access, so every existing `db.select()...` call site elsewhere
// in the app keeps working completely unchanged.
function getDb() {
  const env = getCfEnv();
  if (cached && cached.url === env.DATABASE_URL) return cached.client;
  const client = createClient(env.DATABASE_URL);
  cached = { url: env.DATABASE_URL, client };
  return client;
}

export const db: ReturnType<typeof getDb> = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
