/**
 * Minimal seed: one admin team member + a sample client/campaign so the app
 * has something to show. Run once after migrations:  npm run db:seed
 *
 * Set SEED_ADMIN_EMAIL / SEED_ADMIN_NAME in your env first.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema";

const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase();
const name = process.env.SEED_ADMIN_NAME || "Admin";
if (!email) {
  console.error("Set SEED_ADMIN_EMAIL (and optionally SEED_ADMIN_NAME).");
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

async function main() {
  const existing = await db.query.teamMember.findFirst({
    where: eq(schema.teamMember.email, email),
  });
  if (existing) {
    console.log(`team_member ${email} already exists (${existing.role}).`);
  } else {
    await db.insert(schema.teamMember).values({ email, name, role: "admin" });
    console.log(`Created admin ${name} <${email}>.`);
  }

  const clientCount = await db.$count(schema.client);
  if (clientCount === 0) {
    const [c] = await db
      .insert(schema.client)
      .values({ name: "Exempelkund AB" })
      .returning();
    await db.insert(schema.campaign).values({
      clientId: c.id,
      name: "Exempelkampanj September",
      refNo: "UGC-1",
      market: "SE",
      briefOwner: "agency",
    });
    console.log("Created a sample client + campaign.");
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
