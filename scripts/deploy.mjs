/**
 * Lägger upp KJ Studio på Vercel.
 *
 *   node scripts/deploy.mjs
 *
 * Skriptet skapar/länkar Vercel-projektet, flyttar över miljövariablerna från
 * .env.local och kör en produktionsdeploy. Värdena skickas via stdin och skrivs
 * aldrig ut — varken i terminalen eller i loggarna.
 *
 * Två variabler skiljer sig från den lokala filen och sätts här:
 *   APP_URL     → produktionsadressen (bygger alla länkar som mejlas)
 *   CRON_SECRET → slumpas fram om den saknas, skyddar /api/cron/sla
 *
 * Kräver att du är inloggad: npx vercel login
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const PROJECT = "studio-kj";
const PROD_URL = `https://${PROJECT}.vercel.app`;

/**
 * Variabler som bara hör hemma lokalt. VERCEL_OIDC_TOKEN skriver Vercels eget
 * verktyg in i .env.local; den är kortlivad och ska aldrig sättas som
 * miljövariabel i projektet.
 */
const SKIP = new Set(["SEED_ADMIN_EMAIL", "SEED_ADMIN_NAME", "VERCEL_OIDC_TOKEN"]);

// På Windows blockerar körningspolicyn npx.ps1 — .cmd-varianten går alltid.
const NPX = process.platform === "win32" ? "npx.cmd" : "npx";

const vercel = (args, opts = {}) =>
  spawnSync(NPX, ["--yes", "vercel@latest", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });

/* ---------- 1. Inloggad? ---------------------------------------------- */

const who = vercel(["whoami"]);
const user = (who.stdout || "").trim().split("\n").pop()?.trim();
if (who.status !== 0 || !user || /logged out/i.test(who.stderr || "")) {
  console.error(
    `\nDu är inte inloggad på Vercel.\n\n` + `  npx vercel login\n\n` + `Välj "Continue with GitHub" och kör om mig.\n`,
  );
  process.exit(1);
}
console.log(`Inloggad som ${user}`);

/* ---------- 2. Läs .env.local ----------------------------------------- */

if (!fs.existsSync(ENV_PATH)) {
  console.error("Hittar ingen .env.local. Kör scripts/setup-db.mjs först.");
  process.exit(1);
}

const env = new Map();
for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
  const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (!m) continue;
  const [, key, raw] = m;
  if (SKIP.has(key)) continue;
  env.set(key, raw.trim().replace(/^["']|["']$/g, ""));
}

// Produktionsvärden.
env.set("APP_URL", PROD_URL);
/**
 * Slumpas en gång och skrivs sedan tillbaka till .env.local, så nästa deploy
 * återanvänder samma värde. INTAKE_SECRET ligger inklistrad i Google-
 * formulärens skript – en ny nyckel vid varje deploy hade tystat dem.
 */
const generated = [];
for (const key of ["CRON_SECRET", "INTAKE_SECRET"]) {
  if (!env.get(key)) {
    env.set(key, randomBytes(32).toString("base64url"));
    generated.push(key);
  }
}
if (generated.length) {
  const extra = generated.map((k) => `${k}="${env.get(k)}"`).join("\n");
  fs.writeFileSync(ENV_PATH, `${fs.readFileSync(ENV_PATH, "utf8").replace(/\s*$/, "")}\n\n${extra}\n`);
  console.log(`Slumpade och sparade i .env.local: ${generated.join(", ")}`);
}

for (const required of ["DATABASE_URL", "AUTH_SECRET", "RESEND_API_KEY", "RESEND_FROM"]) {
  if (!env.get(required)) {
    console.error(`${required} saknas i .env.local — kan inte deploya utan den.`);
    process.exit(1);
  }
}
console.log(`Hittade ${env.size} variabler att flytta över: ${[...env.keys()].join(", ")}`);

/* ---------- 3. Länka projektet ---------------------------------------- */

console.log(`\nLänkar Vercel-projektet "${PROJECT}" …`);
const link = vercel(["link", "--yes", "--project", PROJECT]);
if (link.status !== 0) {
  console.error(link.stdout, link.stderr);
  process.exit(1);
}

/* ---------- 4. Miljövariabler ----------------------------------------- */

console.log("\nSätter miljövariabler (värdena skrivs aldrig ut) …");
for (const [key, value] of env) {
  // Ta bort ev. gammalt värde först så skriptet går att köra om.
  vercel(["env", "rm", key, "production", "--yes"], { stdio: "ignore" });
  const add = vercel(["env", "add", key, "production"], { input: `${value}\n` });
  if (add.status !== 0) {
    console.error(`  ✗ ${key}\n${add.stderr}`);
    process.exit(1);
  }
  console.log(`  ✓ ${key}`);
}

/* ---------- 5. Deploy -------------------------------------------------- */

console.log("\nBygger och lägger upp i produktion. Det tar ett par minuter …\n");
const out = vercel(["deploy", "--prod", "--yes"], { stdio: "inherit" });
if (out.status !== 0) {
  console.error("\nDeployen gick inte igenom. Felet står ovanför.");
  process.exit(1);
}

console.log(`\n✓ Uppe på ${PROD_URL}`);
console.log(`  Logga in på ${PROD_URL}/login\n`);
