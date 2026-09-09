import { getCurrentMember, can } from "@/lib/auth";
import { requireDb, schema } from "@/lib/db";
import { searchCreators, type CreatorFilter } from "@/lib/queries";

/**
 * CSV av träfflistan, med samma filter som sidan. Tänkt att matas rakt in i
 * en AI för matchning, så kolumnerna är de som säger något om lämplighet.
 *
 * Filen innehåller personuppgifter – därför bakom inloggning, `noindex`, och
 * aldrig något som ligger kvar på disk.
 */
export const dynamic = "force-dynamic";

const COLUMNS: [string, (c: Row) => unknown][] = [
  ["Namn", (c) => c.name],
  ["Guld", (c) => (c.preferred ? "ja" : "")],
  ["Kön", (c) => (c.gender === "f" ? "kvinna" : c.gender === "m" ? "man" : "")],
  ["Ålder", (c) => c.age],
  ["Land", (c) => c.country],
  ["Stad", (c) => c.city],
  ["Språk", (c) => c.languages],
  ["Nisch", (c) => c.niche],
  ["Plattform", (c) => c.platform],
  ["Kan filma", (c) => c.canFilm],
  ["Nej tack till", (c) => c.noGo],
  ["Erfarenhet", (c) => c.experience],
  ["Riktpris (deras ord)", (c) => c.priceNote],
  ["Riktpris EUR (ca)", (c) => c.priceEur],
  ["Pitch", (c) => c.pitch],
  ["Portfölj", (c) => c.portfolioUrl],
  ["Sociala", (c) => c.socialUrl],
  ["Mejl", (c) => c.email],
  ["Telefon", (c) => c.phone],
];

type Row = Awaited<ReturnType<typeof searchCreators>>["rows"][number];

/** RFC 4180: citera allt, dubbla citattecken inuti. */
function cell(v: unknown) {
  if (v == null) return '""';
  return `"${String(v).replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export async function GET(req: Request) {
  const me = await getCurrentMember();
  if (!can.operate(me)) return new Response("Behörighet saknas.", { status: 403 });

  const sp = new URL(req.url).searchParams;
  const filter: CreatorFilter = {
    q: sp.get("q") ?? undefined,
    country: sp.get("land") ?? undefined,
    platform: sp.get("plattform") ?? undefined,
    gender: sp.get("kon") ?? undefined,
    gold: sp.get("guld") === "1",
    withEmail: sp.get("mejl") === "1",
    maxPrice: Number(sp.get("maxpris")) || undefined,
    sort: (sp.get("sort") as CreatorFilter["sort"]) ?? "gold",
    limit: 5000,
  };

  const { rows } = await searchCreators(filter);

  // Spåret av vem som tog ut listan. Får inte fälla exporten, men ska finnas.
  try {
    await requireDb().insert(schema.exportLog).values({
      memberId: me!.id,
      memberEmail: me!.email,
      rows: rows.length,
      filter: sp.toString() || null,
    });
  } catch (err) {
    console.error("[export] kunde inte logga uttaget:", err);
  }

  const body =
    "﻿" + // BOM så Excel läser å ä ö rätt
    [COLUMNS.map(([h]) => cell(h)).join(","), ...rows.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(","))].join(
      "\r\n",
    );

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kj-kreatorer-${stamp}.csv"`,
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
