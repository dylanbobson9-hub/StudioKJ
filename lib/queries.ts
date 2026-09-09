import "server-only";
import { and, desc, eq, ne } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";

/** Ett uppdrag med kampanj, kund och kreatör påhängda. */
export type BookingRow = Awaited<ReturnType<typeof listBookings>>[number];

export async function listBookings(opts: { campaignId?: string } = {}) {
  const db = requireDb();
  const rows = await db
    .select({
      b: schema.booking,
      creator: { id: schema.creator.id, name: schema.creator.name, platform: schema.creator.platform, preferred: schema.creator.preferred },
      campaign: { id: schema.campaign.id, name: schema.campaign.name, refNo: schema.campaign.refNo },
      client: { id: schema.client.id, name: schema.client.name },
    })
    .from(schema.booking)
    .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
    .innerJoin(schema.campaign, eq(schema.booking.campaignId, schema.campaign.id))
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(opts.campaignId ? eq(schema.booking.campaignId, opts.campaignId) : undefined)
    .orderBy(desc(schema.booking.updatedAt));
  return rows.map((r) => ({ ...r.b, creator: r.creator, campaign: r.campaign, client: r.client }));
}

export async function getBooking(id: string) {
  const rows = await listBookings();
  return rows.find((r) => r.id === id) ?? null;
}

export async function listBookingEvents(bookingId: string) {
  const db = requireDb();
  return db
    .select()
    .from(schema.bookingEvent)
    .where(eq(schema.bookingEvent.bookingId, bookingId))
    .orderBy(desc(schema.bookingEvent.at))
    .limit(60);
}

export async function listClientsWithCampaigns() {
  const db = requireDb();
  const clients = await db.select().from(schema.client).orderBy(schema.client.name);
  const campaigns = await db.select().from(schema.campaign).orderBy(schema.campaign.name);
  const bookings = await db
    .select({ id: schema.booking.id, campaignId: schema.booking.campaignId, stage: schema.booking.stage })
    .from(schema.booking);

  return clients.map((c) => ({
    ...c,
    campaigns: campaigns
      .filter((k) => k.clientId === c.id)
      .map((k) => ({ ...k, bookings: bookings.filter((b) => b.campaignId === k.id) })),
  }));
}

export async function getCampaign(id: string) {
  const db = requireDb();
  const [row] = await db
    .select({ c: schema.campaign, client: schema.client })
    .from(schema.campaign)
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(eq(schema.campaign.id, id))
    .limit(1);
  return row ? { ...row.c, client: row.client } : null;
}

export async function listClients() {
  return requireDb().select().from(schema.client).orderBy(schema.client.name);
}

export async function listCampaigns() {
  const db = requireDb();
  return db
    .select({ c: schema.campaign, client: schema.client })
    .from(schema.campaign)
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .orderBy(schema.campaign.name)
    .then((rows) => rows.map((r) => ({ ...r.c, client: r.client })));
}

/** Kreatörer som ligger på minst ett uppdrag. */
export async function listActiveCreators() {
  const db = requireDb();
  const rows = await db
    .select({ creator: schema.creator, bookingId: schema.booking.id, stage: schema.booking.stage })
    .from(schema.creator)
    .innerJoin(schema.booking, eq(schema.booking.creatorId, schema.creator.id))
    .orderBy(schema.creator.name);
  const byId = new Map<string, { creator: typeof schema.creator.$inferSelect; active: number; total: number }>();
  for (const r of rows) {
    const e = byId.get(r.creator.id) ?? { creator: r.creator, active: 0, total: 0 };
    e.total += 1;
    if (r.stage !== "done") e.active += 1;
    byId.set(r.creator.id, e);
  }
  return [...byId.values()];
}

export async function listTeam() {
  return requireDb().select().from(schema.teamMember).orderBy(schema.teamMember.name);
}

/** Nästa lediga UGC-nummer. */
export async function nextRefNo() {
  const db = requireDb();
  const rows = await db.select({ refNo: schema.campaign.refNo }).from(schema.campaign);
  const max = rows.reduce((m, r) => {
    const n = /UGC-(\d+)/.exec(r.refNo ?? "");
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `UGC-${max + 1}`;
}

/** Aktiva länkar för en kampanj / ett uppdrag. */
export async function listAccessTokens(opts: { campaignId?: string; bookingId?: string }) {
  const db = requireDb();
  const where = opts.campaignId
    ? and(eq(schema.accessToken.campaignId, opts.campaignId), eq(schema.accessToken.revoked, false))
    : opts.bookingId
      ? and(eq(schema.accessToken.bookingId, opts.bookingId), eq(schema.accessToken.revoked, false))
      : ne(schema.accessToken.revoked, true);
  return db.select().from(schema.accessToken).where(where).orderBy(desc(schema.accessToken.createdAt));
}
