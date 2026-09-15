import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Kryptering av personnummer.
 *
 * Personnummer är den känsligaste uppgiften KJ Studio håller och får enligt
 * dataskyddslagen bara behandlas när det är tydligt motiverat — här för att
 * kunna betala och rapportera ersättning till kreatörer utan F-skatt.
 *
 * Det lagras krypterat med AES-256-GCM och en nyckel som bara finns som
 * miljövariabel (`PII_KEY`). En läckt databasdump avslöjar alltså inga
 * personnummer; det krävs både databasen och nyckeln.
 *
 * Tappas nyckeln går personnumren inte att läsa igen. Den ligger i Vercel och
 * i .env.local — rör den inte.
 */

function key(): Buffer {
  const raw = process.env.PII_KEY;
  if (!raw) throw new Error("PII_KEY saknas – personnummer kan inte hanteras.");
  // Nyckeln kan vara vilken lång sträng som helst; härled exakt 32 byte.
  return createHash("sha256").update(raw).digest();
}

/** "v1.<iv>.<tag>.<chiffer>" – versionen gör att nyckeln kan bytas senare. */
export function encryptPII(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptPII(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const [v, iv, tag, enc] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !enc) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
  } catch {
    // Fel nyckel eller manipulerat värde – visa hellre inget än skräp.
    return null;
  }
}

/**
 * Normaliserar till ÅÅÅÅMMDD-XXXX. Tar emot det folk faktiskt skriver:
 * med eller utan sekel, med eller utan bindestreck.
 */
export function normalizePersonalNumber(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let full: string;
  if (digits.length === 12) full = digits;
  else if (digits.length === 10) {
    // Tvåsiffrigt år: "+" betyder över 100, annars närmaste sekel bakåt.
    const yy = Number(digits.slice(0, 2));
    const nowYY = new Date().getFullYear() % 100;
    const century = input.includes("+") || yy > nowYY ? 19 : 20;
    full = `${century}${digits}`;
  } else return null;
  return `${full.slice(0, 8)}-${full.slice(8)}`;
}

/** Luhn-kontroll på de tio sista siffrorna – fångar felskrivningar direkt. */
export function isValidPersonalNumber(normalized: string): boolean {
  const ten = normalized.replace(/\D/g, "").slice(2);
  if (ten.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    let d = Number(ten[i]) * (i % 2 === 0 ? 2 : 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

/** "19900101-••••" – räcker för att känna igen personen, inte för att missbruka numret. */
export function maskPersonalNumber(normalized: string | null): string | null {
  if (!normalized) return null;
  return `${normalized.slice(0, 8)}-••••`;
}
