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
 */

export type BookingLine = {
  bookingId: string;
  creatorName: string;
  clientPrice: number;
  creatorFee: number;
  extraCost: number;
  /** Något är ifyllt – annars är uppdraget inte prissatt ännu. */
  priced: boolean;
  invoicedAt: Date | null;
  paidAt: Date | null;
  note: string | null;
};

export type CampaignPL = {
  campaignId: string;
  lines: BookingLine[];
  agencyFee: number;
  editingCost: number;
  /** Vad kunden faktureras: uppdragen + vårt arvode. */
  invoiced: number;
  /** Vad det kostar oss: kreatörsarvoden, utlägg och redigering. */
  cost: number;
  profit: number;
  /** Vinst delat på fakturerat, eller null när inget är fakturerat. */
  margin: number | null;
  /** Hur många uppdrag som saknar prissättning. */
  unpriced: number;
};

const n = (v: number | null | undefined) => v ?? 0;

export async function campaignPL(campaignId: string): Promise<CampaignPL> {
  const db = requireDb();

  const [bookings, [campEcon]] = await Promise.all([
    db
      .select({ b: schema.booking, creator: schema.creator.name, econ: schema.bookingEcon })
      .from(schema.booking)
      .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
      .leftJoin(schema.bookingEcon, eq(schema.bookingEcon.bookingId, schema.booking.id))
      .where(eq(schema.booking.campaignId, campaignId)),
    db.select().from(schema.campaignEcon).where(eq(schema.campaignEcon.campaignId, campaignId)).limit(1),
  ]);

  const lines: BookingLine[] = bookings
    // Utbytta kreatörer ska inte betalas eller faktureras.
    .filter((r) => !r.b.holdActive)
    .map((r) => ({
      bookingId: r.b.id,
      creatorName: r.creator,
      clientPrice: n(r.econ?.clientPrice),
      creatorFee: n(r.econ?.creatorFee),
      extraCost: n(r.econ?.extraCost),
      priced: r.econ?.clientPrice != null || r.econ?.creatorFee != null,
      invoicedAt: r.econ?.invoicedAt ?? null,
      paidAt: r.econ?.paidAt ?? null,
      note: r.econ?.note ?? null,
    }));

  const agencyFee = n(campEcon?.agencyFee);
  const editingCost = n(campEcon?.editingCost);

  const invoiced = lines.reduce((s, l) => s + l.clientPrice, 0) + agencyFee;
  const cost = lines.reduce((s, l) => s + l.creatorFee + l.extraCost, 0) + editingCost;
  const profit = invoiced - cost;

  return {
    campaignId,
    lines,
    agencyFee,
    editingCost,
    invoiced,
    cost,
    profit,
    margin: invoiced > 0 ? profit / invoiced : null,
    unpriced: lines.filter((l) => !l.priced).length,
  };
}

/** Samma uträkning för flera kampanjer, utan en fråga per kampanj. */
export async function campaignPLs(campaignIds: string[]): Promise<Map<string, CampaignPL>> {
  if (!campaignIds.length) return new Map();
  const db = requireDb();

  const [bookings, campEcons] = await Promise.all([
    db
      .select({ b: schema.booking, creator: schema.creator.name, econ: schema.bookingEcon })
      .from(schema.booking)
      .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
      .leftJoin(schema.bookingEcon, eq(schema.bookingEcon.bookingId, schema.booking.id))
      .where(inArray(schema.booking.campaignId, campaignIds)),
    db.select().from(schema.campaignEcon).where(inArray(schema.campaignEcon.campaignId, campaignIds)),
  ]);

  const econByCampaign = new Map(campEcons.map((e) => [e.campaignId, e]));
  const out = new Map<string, CampaignPL>();

  for (const id of campaignIds) {
    const lines: BookingLine[] = bookings
      .filter((r) => r.b.campaignId === id && !r.b.holdActive)
      .map((r) => ({
        bookingId: r.b.id,
        creatorName: r.creator,
        clientPrice: n(r.econ?.clientPrice),
        creatorFee: n(r.econ?.creatorFee),
        extraCost: n(r.econ?.extraCost),
        priced: r.econ?.clientPrice != null || r.econ?.creatorFee != null,
        invoicedAt: r.econ?.invoicedAt ?? null,
        paidAt: r.econ?.paidAt ?? null,
        note: r.econ?.note ?? null,
      }));

    const e = econByCampaign.get(id);
    const agencyFee = n(e?.agencyFee);
    const editingCost = n(e?.editingCost);
    const invoiced = lines.reduce((s, l) => s + l.clientPrice, 0) + agencyFee;
    const cost = lines.reduce((s, l) => s + l.creatorFee + l.extraCost, 0) + editingCost;
    const profit = invoiced - cost;

    out.set(id, {
      campaignId: id,
      lines,
      agencyFee,
      editingCost,
      invoiced,
      cost,
      profit,
      margin: invoiced > 0 ? profit / invoiced : null,
      unpriced: lines.filter((l) => !l.priced).length,
    });
  }
  return out;
}

/** "12 500 kr" – aldrig ören, aldrig valutakod som ser ut som ett belopp. */
export function kr(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${Math.round(v).toLocaleString("sv-SE")} kr`;
}

export function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)} %`;
}
