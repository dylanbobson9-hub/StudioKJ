import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/*  Domain constants                                                    */
/* ------------------------------------------------------------------ */

/** The 16 pipeline stages a booking moves through, in order. */
export const STAGES = [
  "sourcing", // Kandidat (internal shortlist)
  "creators_review", // Föreslagen till kund
  "price_talk", // Offert & prisförslag
  "confirmed", // Bekräftad
  "product_sent", // Produkt skickad
  "product_received", // Produkt mottagen
  "script", // Manus
  "brief_review", // Brief inväntar godkännande
  "brief_approved", // Brief godkänd
  "filming", // Inspelning pågår
  "editing", // Redigering
  "content_review", // Material inväntar godkännande
  "content_approved", // Material godkänt
  "scheduled", // Inplanerad publicering
  "published", // Publicerat
  "done", // Klar
] as const;
export type Stage = (typeof STAGES)[number];

export const TEAM_ROLES = ["admin", "ekonomi", "crew", "editor"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

export const APPROVAL = ["none", "pending", "approved", "changes", "rejected"] as const;
export type Approval = (typeof APPROVAL)[number];

/* ------------------------------------------------------------------ */
/*  Team                                                                */
/* ------------------------------------------------------------------ */

/** Everyone who can sign in. Also the allow-list: an email not here cannot log in. */
export const teamMember = pgTable("team_member", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").$type<TeamRole>().notNull().default("crew"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One-time magic links for team sign-in. */
export const loginToken = pgTable("login_token", {
  token: text("token").primaryKey(),
  email: text("email").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/** Active team sessions (cookie value = session id). */
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => teamMember.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/*  Clients & campaigns                                                 */
/* ------------------------------------------------------------------ */

export const client = pgTable("client", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  orgNo: text("org_no"),
  invoiceEmail: text("invoice_email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const campaign = pgTable(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => client.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    refNo: text("ref_no"), // UGC-1, UGC-2 …
    market: text("market"), // "SE", "SE, NO"
    startsOn: date("starts_on"),
    brief: text("brief"), // standard brief, inherited by new bookings
    briefOwner: text("brief_owner").$type<"agency" | "client">().notNull().default("agency"),
    editorId: uuid("editor_id").references(() => teamMember.id, { onDelete: "set null" }),
    status: text("status").notNull().default("active"), // active | done | archived
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaign_client_idx").on(t.clientId)],
);

/* ------------------------------------------------------------------ */
/*  Creators                                                            */
/* ------------------------------------------------------------------ */

export const creator = pgTable("creator", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  handle: text("handle"),
  platform: text("platform"),
  email: text("email"),
  phone: text("phone"),
  country: text("country"),
  portfolioUrl: text("portfolio_url"),
  gender: text("gender"),
  age: text("age"),
  priceNote: text("price_note"), // riktpris / video (internal)
  canFilm: text("can_film"),
  noGo: text("no_go"),
  pitch: text("pitch"),
  deliveryInfo: text("delivery_info"),
  shirtSize: text("shirt_size"),
  // Fakturering & bolag — collected before booking (routine "utlandsfakturor")
  companyName: text("company_name"),
  regNumber: text("reg_number"),
  bankAccount: text("bank_account"),
  fSkatt: text("f_skatt"),
  verified: boolean("verified").notNull().default(false),
  // internal only
  preferred: boolean("preferred").notNull().default(false), // guld
  fromCatalog: boolean("from_catalog").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/*  Bookings — one creator on one campaign = one assignment             */
/* ------------------------------------------------------------------ */

export const booking = pgTable(
  "booking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => creator.id, { onDelete: "restrict" }),
    stage: text("stage").$type<Stage>().notNull().default("sourcing"),

    brief: text("brief"),
    briefUrl: text("brief_url"),

    // deliverable spec
    deliverableType: text("deliverable_type").notNull().default("Video"),
    deliverableQty: integer("deliverable_qty").notNull().default(1),
    hooks: integer("hooks").notNull().default(0),
    usageMonths: integer("usage_months").notNull().default(0),
    whitelisting: boolean("whitelisting").notNull().default(false),
    rawMaterial: boolean("raw_material").notNull().default(false),
    deliverableNote: text("deliverable_note"),

    // product / shipping / agreement
    productName: text("product_name"),
    productAddress: text("product_address"),
    carrier: text("carrier"),
    trackingCode: text("tracking_code"),
    trackingUrl: text("tracking_url"),
    sentOn: date("sent_on"),
    receivedOn: date("received_on"),
    agreementSignedAt: timestamp("agreement_signed_at", { withTimezone: true }),
    agreementUrl: text("agreement_url"),

    // approvals
    creatorApproval: text("creator_approval").$type<Approval>().notNull().default("none"),
    briefApproval: text("brief_approval").$type<Approval>().notNull().default("none"),
    contentApproval: text("content_approval").$type<Approval>().notNull().default("none"),
    approvalComment: text("approval_comment"),

    // content
    uploadFolderUrl: text("upload_folder_url"),
    contentLinks: jsonb("content_links").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    contentNote: text("content_note"),
    contentSubmittedAt: timestamp("content_submitted_at", { withTimezone: true }),
    publishedUrl: text("published_url"),

    // hold
    holdActive: boolean("hold_active").notNull().default(false),
    holdReason: text("hold_reason"),
    holdNote: text("hold_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("booking_campaign_idx").on(t.campaignId),
    index("booking_creator_idx").on(t.creatorId),
  ],
);

/** Timeline entries for a booking. */
export const bookingEvent = pgTable(
  "booking_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => booking.id, { onDelete: "cascade" }),
    at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    actor: text("actor").notNull(), // "Kevin · Admin" | "Kund" | "Kreatör"
    text: text("text").notNull(),
  },
  (t) => [index("booking_event_booking_idx").on(t.bookingId)],
);

/* ------------------------------------------------------------------ */
/*  Access tokens — magic links for external client / creator          */
/* ------------------------------------------------------------------ */

export const accessToken = pgTable(
  "access_token",
  {
    token: text("token").primaryKey(),
    kind: text("kind").$type<"client" | "creator">().notNull(),
    campaignId: uuid("campaign_id").references(() => campaign.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id").references(() => booking.id, { onDelete: "cascade" }),
    email: text("email"), // where the link was sent
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [
    index("access_token_campaign_idx").on(t.campaignId),
    index("access_token_booking_idx").on(t.bookingId),
  ],
);

/* ------------------------------------------------------------------ */
/*  Inferred types                                                      */
/* ------------------------------------------------------------------ */

export type TeamMember = typeof teamMember.$inferSelect;
export type Client = typeof client.$inferSelect;
export type Campaign = typeof campaign.$inferSelect;
export type Creator = typeof creator.$inferSelect;
export type Booking = typeof booking.$inferSelect;
export type BookingEvent = typeof bookingEvent.$inferSelect;
export type AccessToken = typeof accessToken.$inferSelect;
