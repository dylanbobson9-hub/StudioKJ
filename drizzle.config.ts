import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });
config();

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
