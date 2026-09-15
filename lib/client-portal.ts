import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { resolveClientToken } from "@/lib/token-actions";
import { campaignPL, type CampaignPL } from "@/lib/econ";
import { STAGE_META, type Stage } from "@/lib/stages";

/**
 * Allt kundportalen visar, hämtat på ett ställe.
 *
 * Gränsen för vad en kund får se dras här, inte i varje vy — annars är det en
 * tidsfråga innan en ny sida råkar rendera ett kreatörsarvode. Kontaktuppgifter,
 * priser och guldmarkeringen lämnar aldrig den här filen.
 */

/** Fälten en kund får se om en kreatör. Allt annat är internt. */
export type PublicCreator = {
  name: string;
  platform: string | null;
  country: string | null;
  city: string | null;
  niche: string | null;
  languages: string | null;
  age: string | null;
  gender: string | null;
  pitch: string | null;
  canFilm: string | null;
  portfolioUrl: string | null;
};

/**
 * Leveransuppgifter. Enda tillfället en kreatörs adress lämnar huset: kunden
 * ska skicka produkten dit och kan inte göra det blint. Sätts bara för det
 * enskilda uppdraget, och bara i fraktsteget — aldrig som ett fält man kan
 * bläddra i katalogen efter.
 */
export type ShipTo = {
  name: string;
  address: string;
  /** Fraktbolagen (PostNord m.fl.) kräver telefon och/eller mejl för aviseringen. */
  phone: string | null;
  email: string | null;
  shirtSize: string | null;
};

export type PortalBooking = {
  id: string;
  stage: Stage;
  creator: PublicCreator;
  brief: string | null;
  briefUrl: string | null;
  contentLinks: string[];
  contentNote: string | null;
  approvalComment: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  publishedUrl: string | null;
  productName: string | null;
  shipTo: ShipTo | null;
  /**
   * Leveransadressen saknas och kunden är i fraktsteget – de kan inte skicka.
   * Det enda "saknas" kunden någonsin ser: personnummer, bank och bolag är
   * våra luckor att täppa, inte deras att känna till.
   */
  addressMissing: boolean;
  deliverableType: string;
  deliverableQty: number;
  updatedAt: Date;
  /** Bollen ligger hos kunden – det här är vad översikten räknar. */
  waiting: boolean;
};

export type Portal = {
  token: string;
  campaign: Awaited<ReturnType<typeof resolveClientToken>>;
  bookings: PortalBooking[];
  waiting: PortalBooking[];
  pl: CampaignPL;
};

const WAITING_STAGES: Stage[] = ["creators_review", "brief_review", "content_review"];

/** Adressen KJ lagt in på uppdraget går före kreatörens egen. */
function shipTo(
  b: typeof schema.booking.$inferSelect,
  c: typeof schema.creator.$inferSelect,
): ShipTo | null {
  if (b.stage !== "confirmed" && b.stage !== "product_sent") return null;
  const address = b.productAddress || c.address;
  if (!address) return null;
  return { name: c.name, address, phone: c.phone, email: c.email, shirtSize: c.shirtSize };
}

function publicCreator(c: typeof schema.creator.$inferSelect): PublicCreator {
  return {
    name: c.name,
    platform: c.platform,
    country: c.country,
    city: c.city,
    niche: c.niche,
    languages: c.languages,
    age: c.age,
    gender: c.gender,
    pitch: c.pitch,
    canFilm: c.canFilm,
    portfolioUrl: c.portfolioUrl,
  };
}

/** null när länken inte gäller – anroparen ska då svara 404. */
export async function loadPortal(token: string): Promise<Portal | null> {
  const campaign = await resolveClientToken(token);
  if (!campaign) return null;

  // Uppdragen och ekonomin beror bara på kampanjen – hämta dem samtidigt.
  const db = requireDb();
  const [rows, pl] = await Promise.all([
    db
      .select({ b: schema.booking, creator: schema.creator })
      .from(schema.booking)
      .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
      .where(eq(schema.booking.campaignId, campaign.id)),
    campaignPL(campaign.id),
  ]);

  const bookings: PortalBooking[] = rows
    // Kandidater är interna tills vi föreslår dem. Utbytta göms helt.
    .filter((r) => r.b.stage !== "sourcing" && !r.b.holdActive)
    .map((r) => ({
      id: r.b.id,
      stage: r.b.stage,
      creator: publicCreator(r.creator),
      brief: r.b.brief,
      briefUrl: r.b.briefUrl,
      contentLinks: r.b.contentLinks,
      contentNote: r.b.contentNote,
      approvalComment: r.b.approvalComment,
      trackingUrl: r.b.trackingUrl,
      carrier: r.b.carrier,
      publishedUrl: r.b.publishedUrl,
      productName: r.b.productName,
      shipTo: shipTo(r.b, r.creator),
      addressMissing:
        (r.b.stage === "confirmed" || r.b.stage === "product_sent") && !r.b.productAddress && !r.creator.address,
      deliverableType: r.b.deliverableType,
      deliverableQty: r.b.deliverableQty,
      updatedAt: r.b.updatedAt,
      waiting: WAITING_STAGES.includes(r.b.stage),
    }))
    .sort((a, b) => a.creator.name.localeCompare(b.creator.name, "sv"));

  return {
    token,
    campaign,
    bookings,
    waiting: bookings.filter((b) => b.waiting),
    pl,
  };
}

/**
 * Tidslinjen, tvättad. Interna aktörer blir "KJ Marketing Sweden": kunden
 * behöver veta att något hände, inte vem hos oss som gjorde det.
 */
export async function portalTimeline(bookingIds: string[], limit = 40) {
  if (!bookingIds.length) return [];
  const rows = await requireDb()
    .select()
    .from(schema.bookingEvent)
    .where(inArray(schema.bookingEvent.bookingId, bookingIds))
    .orderBy(asc(schema.bookingEvent.at));

  return rows
    .slice(-limit)
    .reverse()
    .map((e) => ({
      id: e.id,
      bookingId: e.bookingId,
      at: e.at,
      actor: e.actor === "Kund" || e.actor === "Kreatör" ? e.actor : "KJ Marketing Sweden",
      text: e.text,
    }));
}

/** Vems tur det är, i kundens språk. */
export function whoseTurn(stage: Stage): { label: string; you: boolean } {
  const actor = STAGE_META[stage].actor;
  if (actor === "client") return { label: "Väntar på er", you: true };
  if (actor === "creator") return { label: "Hos kreatören", you: false };
  if (actor === "internal") return { label: "Hos KJ", you: false };
  return { label: "Klart", you: false };
}
