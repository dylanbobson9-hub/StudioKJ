/**
 * Kopplar in Resend. Läser API-nyckeln ur .resend-key.txt (gitignorerad),
 * kontrollerar att den fungerar, visar vilka domäner som är verifierade,
 * skriver RESEND_API_KEY + RESEND_FROM till .env.local och raderar filen.
 *
 *   node scripts/set-resend.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const KEY_PATH = path.join(ROOT, ".resend-key.txt");

const key =
  (fs.existsSync(KEY_PATH) ? fs.readFileSync(KEY_PATH, "utf8").trim() : "") ||
  (process.env.RESEND_API_KEY || "").trim();

if (!key) {
  console.error(
    `\nIngen API-nyckel hittades.\n\n` +
      `  1. notepad .resend-key.txt\n` +
      `  2. Klistra in nyckeln från Resend (börjar med re_), spara och stäng\n` +
      `  3. node scripts/set-resend.mjs\n\n` +
      `Filen raderas automatiskt när nyckeln validerats.\n`,
  );
  process.exit(1);
}
if (!key.startsWith("re_")) {
  console.error("Det ser inte ut som en Resend-nyckel (ska börja med re_). Avbryter.");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
}).catch((e) => {
  console.error("Kunde inte nå Resend:", e.message);
  process.exit(1);
});

if (!res.ok) {
  console.error(`Resend svarade ${res.status}. Är nyckeln rätt och aktiv?`);
  process.exit(1);
}

const { data = [] } = await res.json();
if (!data.length) {
  console.error("\nNyckeln fungerar, men inga domäner är tillagda i Resend ännu.");
  console.error("Lägg till en subdomän (t.ex. send.kjmarketingsweden.com) först.\n");
  process.exit(1);
}

console.log("\nDomäner i ditt Resend-konto:");
for (const d of data) console.log(`  ${d.status === "verified" ? "✓" : "…"} ${d.name} (${d.status})`);

const verified = data.filter((d) => d.status === "verified");
if (!verified.length) {
  console.error(
    `\nIngen domän är verifierad ännu. Lägg in DNS-posterna i Route 53 och vänta\n` +
      `tills Resend visar "Verified" – kör sedan skriptet igen.\n`,
  );
  process.exit(1);
}

// Föredra en KJ-domän om det finns flera.
const domain = (verified.find((d) => /kjmarketingsweden/i.test(d.name)) ?? verified[0]).name;
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
console.log(`\nStarta om servern så mejlas länkarna på riktigt.\n`);
