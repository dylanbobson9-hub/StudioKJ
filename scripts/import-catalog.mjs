/**
 * Läser in kreatörskatalogen i databasen.
 *
 *   node scripts/import-catalog.mjs <sökväg till regi.html eller creators.json>
 *
 * Katalogen innehåller mejladresser, telefonnummer och hemadresser till drygt
 * tusen riktiga personer. Repot är publikt, så datan får ALDRIG committas —
 * den går direkt härifrån till databasen. `data/` är gitignorerad.
 *
 * Körs om utan risk: kreatörer matchas på namn, befintliga uppdateras med de
 * fält som saknas och nya läggs till.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

const ROOT = path.resolve(import.meta.dirname, "..");
config({ path: path.join(ROOT, ".env.local") });

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error(`\nAnge källfilen:\n\n  node scripts/import-catalog.mjs ..\\regi.html\n`);
  process.exit(1);
}

/* ---------- Läs ut CATALOG ------------------------------------------- */

function readCatalog(file) {
  const raw = fs.readFileSync(file, "utf8");
  if (file.endsWith(".json")) return JSON.parse(raw);

  const marker = raw.indexOf("const CATALOG = [");
  if (marker < 0) throw new Error("Hittar ingen CATALOG i filen.");
  const open = raw.indexOf("[", marker);

  // Räkna klamrar, men hoppa över allt som ligger inuti en sträng.
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = open; i < raw.length; i++) {
    const c = raw[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) return JSON.parse(raw.slice(open, i + 1));
  }
  throw new Error("CATALOG-arrayen tar aldrig slut.");
}

/* ---------- Kompakta nycklar → kolumner ------------------------------ */

const clean = (v) => {
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  return s && s !== "-" && s !== "–" ? s : null;
};

function toRow(c) {
  return {
    name: clean(c.n),
    gender: clean(c.g),
    age: clean(c.a),
    country: clean(c.co),
    city: clean(c.ci),
    niche: clean(c.ni),
    price_note: clean(c.px),
    price_eur: Number.isFinite(c.pe) ? c.pe : null,
    experience: clean(c.ex),
    can_film: clean(c.ca),
    no_go: clean(c.ng),
    pitch: clean(c.pi),
    portfolio_url: clean(c.po),
    social_url: clean(c.so),
    platform: clean(c.pl),
    email: clean(c.em)?.toLowerCase() ?? null,
    phone: clean(c.ph),
    address: clean(c.ad),
    shirt_size: clean(c.sh),
    languages: clean(c.la),
    preferred: !!c.pf,
  };
}

/* ---------- Kör ------------------------------------------------------- */

const catalog = readCatalog(SRC).map(toRow).filter((r) => r.name);
console.log(`Läste ${catalog.length} kreatörer ur ${path.basename(SRC)}`);
console.log(`  ${catalog.filter((r) => r.preferred).length} guldmarkerade`);
console.log(`  ${catalog.filter((r) => r.email).length} med mejl`);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL saknas — kör scripts/setup-db.mjs först.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { prepare: false });

const existing = await sql`select id, lower(name) as key from creator`;
const byName = new Map(existing.map((r) => [r.key, r.id]));

let added = 0;
let updated = 0;

for (const r of catalog) {
  const id = byName.get(r.name.toLowerCase());
  if (id) {
    // Fyll bara luckor — det som redan står i databasen är nyare än katalogen.
    await sql`
      update creator set
        gender        = coalesce(gender, ${r.gender}),
        age           = coalesce(age, ${r.age}),
        country       = coalesce(country, ${r.country}),
        city          = coalesce(city, ${r.city}),
        niche         = coalesce(niche, ${r.niche}),
        price_note    = coalesce(price_note, ${r.price_note}),
        price_eur     = coalesce(price_eur, ${r.price_eur}),
        experience    = coalesce(experience, ${r.experience}),
        can_film      = coalesce(can_film, ${r.can_film}),
        no_go         = coalesce(no_go, ${r.no_go}),
        pitch         = coalesce(pitch, ${r.pitch}),
        portfolio_url = coalesce(portfolio_url, ${r.portfolio_url}),
        social_url    = coalesce(social_url, ${r.social_url}),
        platform      = coalesce(platform, ${r.platform}),
        email         = coalesce(email, ${r.email}),
        phone         = coalesce(phone, ${r.phone}),
        address       = coalesce(address, ${r.address}),
        shirt_size    = coalesce(shirt_size, ${r.shirt_size}),
        languages     = coalesce(languages, ${r.languages}),
        preferred     = preferred or ${r.preferred},
        from_catalog  = true
      where id = ${id}`;
    updated++;
  } else {
    await sql`insert into creator ${sql({ ...r, from_catalog: true })}`;
    added++;
    byName.set(r.name.toLowerCase(), true);
  }
}

const [{ count }] = await sql`select count(*)::int as count from creator`;
const [{ gold }] = await sql`select count(*)::int as gold from creator where preferred`;
console.log(`\n✓ ${added} nya, ${updated} uppdaterade`);
console.log(`  Databasen har nu ${count} kreatörer, varav ${gold} guld.`);
await sql.end();
