import type { MetadataRoute } from "next";

/**
 * KJ Studio är ett internt verktyg och ska aldrig hamna i en sökmotor.
 * Sidorna skickar redan `noindex` via layouten – det här stoppar sökrobotarna
 * ett steg tidigare, innan de ens hämtar en sida. Framför allt gäller det
 * kund- och kreatörslänkarna: de är hemliga just för att ingen delar dem
 * vidare, och en indexerad länk vore ett läckt uppdrag.
 */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
