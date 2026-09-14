import "server-only";
import { eq, inArray } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";

/**
 * Ekonomin för en kampanj.
 *
 * Allt i hela kronor exklusive moms. Det enda stället där en kampanjs summor
 * räknas fram — vår ekonomivy och kundens portal läser samma funktion, så de
 * kan inte visa olika belopp. I prototypen fanns två uträkningar och kundens
 * total saknade byråarvodet.
 *
 * Två prismodeller:
 *
 *   **Fast budget** – kunden köper ett resultat för en summa. Vi bestämmer hur
 *   många kreatörer som får plats. Kundens total är budgeten, punkt; vad
 *   kreatörerna kostar oss rör aldrig deras siffra, och vinsten är det som
 *   blir över.
 *
 *   **Pris per uppdrag** – kunden betalar per kreatör plus vårt arvode.
 *
 * Vilken som gäller avgörs av om `budget` är ifylld.
 */

export type BookingLine = {
  bookingId: string;
  creatorName: string;
  clientPrice: number;
  creatorFee: number;
  extraCost: number;
  /** Prissatt på den sida som spelar roll i den valda prismodellen. */
  priced: boolean;
  invoicedAt: Date | null;
  paidAt: Date | null;
  note: string | null;
};

export type CampaignPL = {
  campaignId: string;
  lines: BookingLine[];
  /** Satt = fast budget. Null = pris per uppdrag. */
  budget: number | null;
  fixedPrice: boolean;
  agencyFee: number;
  editingCost: number;
  /** Vad kunden faktureras. */
  invoiced: number;
  /** Vad det kostar oss: kreatörsarvoden, utlägg och redigering. */
  cost: number;
  profit: number;
  /** Vinst delat på fakturerat, eller null när inget är fakturerat. */
  margin: number | null;
  /** Uppdrag som saknar de siffror den valda modellen behöver. */
  unpriced: number;
};

const n = (v: number | null | undefined) => v ?? 0;

type Row = {
  b: typeof schema.booking.$inferSelect;
  creator: string;
  econ: typeof schema.bookingEcon.$inferSelect | null;
};

function build(
  campaignId: string,
  rows: Row[],
  econ: typeof schema.campaignEcon.$inferSelect | undefined,
): CampaignPL {
  const budget = econ?.budget ?? null;
  const fixedPrice = budget != null;

  const lines: BookingLine[] = rows
    // Utbytta kreatörer ska inte betalas eller faktureras.
    .filter((r) => !r.b.holdActive)
    .map((r) => ({
      bookingId: r.b.id,
      creatorName: r.creator,
      clientPrice: n(r.econ?.clientPrice),
      creatorFee: n(r.econ?.creatorFee),
      extraCost: n(r.econ?.extraCost),
      // I budgetmodellen är kundpriset irrelevant – bara vår kostnad behövs.
      priced: fixedPrice
        ? r.econ?.creatorFee != null
        : r.econ?.clientPrice != null || r.econ?.creatorFee != null,
      invoicedAt: r.econ?.invoicedAt ?? null,
      paidAt: r.econ?.paidAt ?? null,
      note: r.econ?.note ?? null,
    }));

  const agencyFee = n(econ?.agencyFee);
  const editingCost = n(econ?.editingCost);

  const invoiced = fixedPrice ? budget! : lines.reduce((s, l) => s + l.clientPrice, 0) + agencyFee;
  const cost = lines.reduce((s, l) => s + l.creatorFee + l.extraCost, 0) + editingCost;
  const profit = invoiced - cost;

  return {
    campaignId,
    lines,
    budget,
    fixedPrice,
    agencyFee,
    editingCost,
    invoiced,
    cost,
    profit,
    margin: invoiced > 0 ? profit / invoiced : null,
    unpriced: lines.filter((l) => !l.priced).length,
  };
}

export async function campaignPL(campaignId: string): Promise<CampaignPL> {
  const db = requireDb();
  const [rows, [econ]] = await Promise.all([
    db
      .select({ b: schema.booking, creator: schema.creator.name, econ: schema.bookingEcon })
      .from(schema.booking)
      .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
      .leftJoin(schema.bookingEcon, eq(schema.bookingEcon.bookingId, schema.booking.id))
      .where(eq(schema.booking.campaignId, campaignId)),
    db.select().from(schema.campaignEcon).where(eq(schema.campaignEcon.campaignId, campaignId)).limit(1),
  ]);
  return build(campaignId, rows, econ);
}

/** Samma uträkning för flera kampanjer, utan en fråga per kampanj. */
export async function campaignPLs(campaignIds: string[]): Promise<Map<string, CampaignPL>> {
  if (!campaignIds.length) return new Map();
  const db = requireDb();

  const [rows, econs] = await Promise.all([
    db
      .select({ b: schema.booking, creator: schema.creator.name, econ: schema.bookingEcon })
      .from(schema.booking)
      .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
      .leftJoin(schema.bookingEcon, eq(schema.bookingEcon.bookingId, schema.booking.id))
      .where(inArray(schema.booking.campaignId, campaignIds)),
    db.select().from(schema.campaignEcon).where(inArray(schema.campaignEcon.campaignId, campaignIds)),
  ]);

  const byCampaign = new Map(econs.map((e) => [e.campaignId, e]));
  return new Map(
    campaignIds.map((id) => [
      id,
      build(
        id,
        rows.filter((r) => r.b.campaignId === id),
        byCampaign.get(id),
      ),
    ]),
  );
}

/** "12 500 kr" – aldrig ören, aldrig valutakod som ser ut som ett belopp. */
export function kr(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v).toLocaleString("sv-SE")} kr`;
}

export function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)} %`;
}
