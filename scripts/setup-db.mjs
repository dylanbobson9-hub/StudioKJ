/**
 * Engångs-setup: frågar efter Supabase-databaslösenordet, listar ut vilken
 * pooler-värd projektet ligger på, testar anslutningen och skriver .env.local.
 *
 *   node scripts/setup-db.mjs
 *
 * Lösenordet skrivs bara till .env.local (som är gitignorerad) och skickas
 * ingen annanstans.
 */
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const REF = process.env.SUPABASE_REF || "leifsetqzaybxdhzwluv";
const REGION = process.env.SUPABASE_REGION || "eu-north-1";
const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = function (str) {
      if (!rl.stdoutMuted) rl.output.write(str);
    };
    process.stdout.write(question);
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

/** Kandidater i den ordning vi testar dem. */
function candidates(pw) {
  const enc = encodeURIComponent(pw);
  const hosts = [`aws-1-${REGION}.pooler.supabase.com`, `aws-0-${REGION}.pooler.supabase.com`];
  const out = [];
  for (const host of hosts) {
    out.push({
      label: `Session pooler · ${host}`,
      host,
      session: `postgresql://postgres.${REF}:${enc}@${host}:5432/postgres`,
      pooled: `postgresql://postgres.${REF}:${enc}@${host}:6543/postgres`,
    });
  }
  out.push({
    label: `Direktanslutning · db.${REF}.supabase.co (kräver IPv6)`,
    host: `db.${REF}.supabase.co`,
    session: `postgresql://postgres:${enc}@db.${REF}.supabase.co:5432/postgres`,
    pooled: `postgresql://postgres:${enc}@db.${REF}.supabase.co:5432/postgres`,
  });
  return out;
}

async function tryConnect(url) {
  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 10, idle_timeout: 2 });
  try {
    await sql`select 1`;
    return true;
  } catch (e) {
    return e.message || String(e);
  } finally {
    try { await sql.end({ timeout: 2 }); } catch { /* ignore */ }
  }
}

const main = async () => {
  console.log(`\nKJ Studio – databasuppkoppling`);
  console.log(`Projekt: ${REF} (${REGION})\n`);

  const pw = await askHidden("Klistra in databaslösenordet från Supabase (syns inte): ");
  if (!pw.trim()) {
    console.error("Inget lösenord angavs. Avbryter.");
    process.exit(1);
  }

  let picked = null;
  for (const c of candidates(pw.trim())) {
    process.stdout.write(`Testar ${c.label} … `);
    const res = await tryConnect(c.session);
    if (res === true) {
      console.log("OK ✓");
      picked = c;
      break;
    }
    console.log("nej");
    if (/password authentication failed/i.test(String(res))) {
      console.error(`\n✗ Fel lösenord. Kör om skriptet, eller återställ lösenordet i Supabase\n  (Connect → Direct → "Reset database password").`);
      process.exit(1);
    }
  }

  if (!picked) {
    console.error(`\n✗ Kunde inte nå databasen på någon av adresserna.\n  Kolla att projektet är "Healthy" i Supabase och att du har internet.`);
    process.exit(1);
  }

  const prev = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
  const keep = (key, fallback) => {
    const m = prev.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, "m"));
    return m && m[1] && !/KLISTRA_IN/.test(m[1]) ? m[1] : fallback;
  };

  const body = `# Skapad av scripts/setup-db.mjs — gitignorerad, dela aldrig.
DATABASE_URL="${picked.pooled}"
DATABASE_URL_DIRECT="${picked.session}"

APP_URL="${keep("APP_URL", "http://localhost:3000")}"
AUTH_SECRET="${keep("AUTH_SECRET", randomBytes(32).toString("base64"))}"

# E-post (fylls i när Resend-domänen är verifierad)
RESEND_API_KEY="${keep("RESEND_API_KEY", "")}"
RESEND_FROM="${keep("RESEND_FROM", "KJ Studio <studio@kjmarketingsweden.com>")}"

# Seed-admin
SEED_ADMIN_EMAIL="${keep("SEED_ADMIN_EMAIL", "kjmarketingsweden@gmail.com")}"
SEED_ADMIN_NAME="${keep("SEED_ADMIN_NAME", "Kevin Jansson")}"
`;

  fs.writeFileSync(ENV_PATH, body);
  console.log(`\n✓ Skrev .env.local (${picked.host})`);
  console.log(`\nNästa steg:\n  npm run db:push    # skapar tabellerna\n  npm run db:seed    # lägger in dig som admin\n  npm run dev        # starta appen\n`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
