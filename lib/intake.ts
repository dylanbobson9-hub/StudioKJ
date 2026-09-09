import "server-only";

/**
 * Översätter ett Google-formulärsvar till kolumner på `creator`.
 *
 * Formulären finns på både svenska och engelska och frågorna skrivs om då och
 * då, så mappningen matchar på nyckelord i frågetexten i stället för exakta
 * rubriker. Den kommer aldrig att träffa allt – därför sparas hela råsvaret i
 * `raw_intake`, och inget som någon skrivit går förlorat även när vi missar
 * en rubrik.
 */

type Rule = {
  field: string;
  /** Frågan ska innehålla något av de här. */
  any: string[];
  /** …men inget av de här. */
  not?: string[];
};

/**
 * Ordningen är prioritet: specifika regler först, breda sist. Nyckelorden är
 * hämtade ur de två skarpa formulären ("Blir en kreatör…" och "Become a
 * creator…") men hålls medvetet lite bredare än de exakta rubrikerna, så en
 * omformulerad fråga inte tystar hela fältet.
 */
const RULES: Rule[] = [
  { field: "companyName", any: ["företagsnamn", "company name", "bolagsnamn", "firma"] },
  { field: "regNumber", any: ["organisationsnummer", "org.nr", "orgnr", "registration number"] },
  { field: "portfolioUrl", any: ["portfölj", "portfolio", "arbetsprover", "showreel"] },
  {
    field: "socialUrl",
    any: ["sociala medier", "social media", "social medias", "länk till dina", "link to your social", "tiktok", "instagram"],
  },
  { field: "platform", any: ["plattform", "vilka kanaler", "which platform"] },
  // Före canFilm: båda handlar om vad de gör, den negativa är den snävare.
  { field: "noGo", any: ["inte vill", "inte göra", "don't want", "dont want", "not want", "nej tack", "no-go", "undvik"] },
  { field: "canFilm", any: ["kan göra detta", "i can do this", "kan du filma", "can you film", "kan filma"] },
  { field: "pitch", any: ["varför", "why", "berätta om dig", "tell us about"] },
  { field: "experience", any: ["hur länge", "how long", "erfarenhet", "experience"] },
  { field: "priceNote", any: ["pris", "price", "kostar", "arvode", "rate"] },
  // "size" ensamt matchar även "Shoe size", så tröjan får en egen regel först.
  { field: "shirtSize", any: ["tröjstorlek", "t-shirt size", "tshirt", "tröj"] },
  { field: "address", any: ["leveransadress", "delivery adress", "delivery address", "adress", "address"] },
  { field: "languages", any: ["språk", "language"] },
  { field: "niche", any: ["nisch", "niche", "kategori", "inriktning"] },
  { field: "city", any: ["vilken stad", "your city", "ort", "var bor du"] },
  { field: "country", any: ["country", "vilket land", "ditt land"] },
  { field: "age", any: ["ålder", "age"] },
  { field: "gender", any: ["kön", "gender"] },
  { field: "phone", any: ["telefon", "phone", "mobil"] },
  { field: "email", any: ["e-post", "epost", "mejl", "email", "e-mail"] },
  {
    field: "name",
    any: ["vad heter du", "your name", "namn", "name"],
    not: ["företag", "company", "bolag", "användarnamn", "username"],
  },
];

/** GDPR-rutan är ett samtycke, inte ett svar om personen. */
const SKIP = ["gdpr", "samtycke", "villkor"];

const clean = (v: unknown): string | null => {
  const s = Array.isArray(v) ? v.join(", ") : typeof v === "string" ? v : v == null ? "" : String(v);
  const t = s.trim();
  return t && t !== "-" ? t : null;
};

/** "m" / "f" ur vad folk faktiskt skriver i en könsruta. */
function gender(v: string | null): string | null {
  if (!v) return null;
  const s = v.toLowerCase();
  if (/^(kvinna|female|woman|kvinnlig|hon|f)\b/.test(s)) return "f";
  if (/^(man|male|manlig|han|m)\b/.test(s)) return "m";
  return null;
}

export type IntakeResult = {
  values: Record<string, string | null>;
  /** Frågor vi inte kunde placera – hamnar ändå i raw_intake. */
  unmapped: string[];
};

export function mapIntake(answers: Record<string, unknown>): IntakeResult {
  const entries = Object.entries(answers)
    .map(([q, v]) => ({ q, key: q.toLowerCase(), value: clean(v) }))
    .filter((e) => !SKIP.some((s) => e.key.includes(s)));
  const used = new Set<string>();
  const values: Record<string, string | null> = {};

  for (const rule of RULES) {
    const hit = entries.find(
      (e) =>
        !used.has(e.q) &&
        e.value &&
        rule.any.some((k) => e.key.includes(k)) &&
        !(rule.not ?? []).some((k) => e.key.includes(k)),
    );
    if (hit) {
      values[rule.field] = hit.value;
      used.add(hit.q);
    }
  }

  if (values.gender) values.gender = gender(values.gender);
  if (values.email) values.email = values.email.toLowerCase();

  return {
    values,
    unmapped: entries.filter((e) => e.value && !used.has(e.q)).map((e) => e.q),
  };
}
