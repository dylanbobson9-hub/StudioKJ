import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;

/**
 * A single pooled client, reused across hot-reloads in dev.
 * `db` is `null` when DATABASE_URL is not set — call sites should surface a
 * clear "database not configured" message rather than crash the whole app.
 */
declare global {
  // eslint-disable-next-line no-var
  var __studiokj_pg: ReturnType<typeof postgres> | undefined;
}

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

if (url) {
  const client = global.__studiokj_pg ?? postgres(url, { prepare: false });
  if (process.env.NODE_ENV !== "production") global.__studiokj_pg = client;
  db = drizzle(client, { schema });
} else if (process.env.NODE_ENV !== "production") {
  console.warn("[db] DATABASE_URL is not set — database features are disabled.");
}

export { db, schema };

export function requireDb() {
  if (!db) throw new Error("DATABASE_URL is not configured.");
  return db;
}
