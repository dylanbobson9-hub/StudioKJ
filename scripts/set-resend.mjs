/**
 * Kopplar in Resend. Läser API-nyckeln ur .resend-key.txt (gitignorerad),
 * skriver RESEND_API_KEY + RESEND_FROM till .env.local och raderar filen.
 *
 *   node scripts/set-resend.mjs [avsändardomän]
 *
 * En nyckel med "Sending access" får bara skicka mail — den får inte lista
 * domäner. Kan vi inte läsa domänlistan antar vi därför att nyckeln är
 * korrekt scopead och tar domänen från argumentet istället.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const KEY_PATH = path.join(ROOT, ".resend-key.txt");

const argDomain = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

const key =
  (fs.existsSync(KEY_PATH) ? fs.readFileSync(KEY_PATH, "utf8").trim() : "") ||
  (process.env.RESEND_API_KEY || "").trim();

if (!key) {
  console.error(
    `\nIngen API-nyckel hittades.\n\n` +
      `  1. notepad .resend-key.txt\n` +
      `  2. Klistra in nyckeln från Resend (börjar med re_), spara och stäng\n` +
      `  3. node scripts/set-resend.mjs send.dindoman.com\n`,
  );
  process.exit(1);
}
if (!/^re_[A-Za-z0-9_-]{10,}$/.test(key)) {
  console.error("Det ser inte ut som en komplett Resend-nyckel (re_… ). Kontrollera att hela raden kom med.");
  process.exit(1);
}

/** Full access-nycklar kan lista domäner; sending-nycklar kan inte. */
async function verifiedDomains() {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);
  if (!res) return { reachable: false, domains: null };
  if (res.status === 401 || res.status === 403) return { reachable: true, domains: null }; // sending-scoped
  if (!res.ok) return { reachable: true, domains: null };
  const { data = [] } = await res.json();
  return { reachable: true, domains: data };
}

const { reachable, domains } = await verifiedDomains();
if (!reachable) {
  console.error("Kunde inte nå Resend. Kolla internetanslutningen och försök igen.");
  process.exit(1);
}

let domain = argDomain;

if (domains) {
  console.log("\nDomäner i ditt Resend-konto:");
  for (const d of domains) console.log(`  ${d.status === "verified" ? "✓" : "…"} ${d.name} (${d.status})`);
  const verified = domains.filter((d) => d.status === "verified");
  if (!verified.length) {
    console.error(`\nIngen domän är verifierad ännu. Vänta tills Resend visar "Verified" och kör om.\n`);
    process.exit(1);
  }
  domain =
    argDomain ||
    (verified.find((d) => /kjmarketing/i.test(d.name)) ?? verified[0]).name;
} else {
  console.log("\nNyckeln är scopead till att bara skicka mail — kan inte läsa domänlistan.");
  console.log("Det är rätt inställning; jag litar på den och använder domänen du anger.");
  if (!domain) {
    console.error(
      `\nAnge avsändardomänen som argument:\n\n` +
        `  node scripts/set-resend.mjs send.kjmarketingnorway.com\n`,
    );
    process.exit(1);
  }
}

const from = `KJ Studio <studio@${domain}>`;

const prev = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf8") : "";
const setLine = (src, k, v) =>
  new RegExp(`^${k}=.*$`, "m").test(src)
    ? src.replace(new RegExp(`^${k}=.*$`, "m"), `${k}="${v}"`)
    : `${src.replace(/\s*$/, "")}\n${k}="${v}"\n`;

let next = setLine(prev, "RESEND_API_KEY", key);
next = setLine(next, "RESEND_FROM", from);
fs.writeFileSync(ENV_PATH, next);
console.log(`\n✓ Skrev RESEND_API_KEY och RESEND_FROM till .env.local`);
console.log(`  Avsändare: ${from}`);

if (fs.existsSync(KEY_PATH)) {
  try {
    fs.writeFileSync(KEY_PATH, "x".repeat(64));
    fs.unlinkSync(KEY_PATH);
    console.log(`✓ Raderade .resend-key.txt`);
  } catch {
    console.log(`OBS: kunde inte radera .resend-key.txt – ta bort den manuellt.`);
  }
}
console.log(`\nStarta om servern (npm.cmd run dev) så mejlas länkarna på riktigt.\n`);
