"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { stageLabel, type Stage } from "@/lib/stages";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ------------------------------------------------------------------ */
/*  Token-upplösning — ersätter inloggning för kund och kreatör         */
/* ------------------------------------------------------------------ */

/** Kampanjen en kundlänk pekar på, eller null om länken inte gäller. */
export async function resolveClientToken(token: string) {
  if (!token) return null;
  const db = requireDb();
  const [t] = await db
    .select()
    .from(schema.accessToken)
    .where(
      and(
        eq(schema.accessToken.token, token),
        eq(schema.accessToken.kind, "client"),
        eq(schema.accessToken.revoked, false),
      ),
    )
    .limit(1);
  if (!t?.campaignId) return null;

  const [row] = await db
    .select({ c: schema.campaign, client: schema.client })
    .from(schema.campaign)
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(eq(schema.campaign.id, t.campaignId))
    .limit(1);
  return row ? { ...row.c, client: row.client } : null;
}

/** Uppdraget en kreatörslänk pekar på, eller null. */
export async function resolveCreatorToken(token: string) {
  if (!token) return null;
  const db = requireDb();
  const [t] = await db
    .select()
    .from(schema.accessToken)
    .where(
      and(
        eq(schema.accessToken.token, token),
        eq(schema.accessToken.kind, "creator"),
        eq(schema.accessToken.revoked, false),
      ),
    )
    .limit(1);
  if (!t?.bookingId) return null;

  const [row] = await db
    .select({ b: schema.booking, creator: schema.creator, campaign: schema.campaign, client: schema.client })
    .from(schema.booking)
    .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
    .innerJoin(schema.campaign, eq(schema.booking.campaignId, schema.campaign.id))
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(eq(schema.booking.id, t.bookingId))
    .limit(1);
  return row ? { ...row.b, creator: row.creator, campaign: row.campaign, client: row.client } : null;
}

export async function touchToken(token: string) {
  await requireDb()
    .update(schema.accessToken)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.accessToken.token, token));
}

/** Bekräftar att uppdraget hör till kampanjen som kundlänken öppnar. */
async function bookingForClientToken(token: string, bookingId: string) {
  const camp = await resolveClientToken(token);
  if (!camp) return null;
  const db = requireDb();
  const [b] = await db.select().from(schema.booking).where(eq(schema.booking.id, bookingId)).limit(1);
  return b && b.campaignId === camp.id ? b : null;
}

async function logEvent(bookingId: string, actor: string, text: string) {
  await requireDb().insert(schema.bookingEvent).values({ bookingId, actor, text });
}

async function moveStage(bookingId: string, stage: Stage, extra: Record<string, unknown> = {}) {
  await requireDb()
    .update(schema.booking)
    .set({ stage, stageSince: new Date(), reminderSentAt: null, updatedAt: new Date(), ...extra })
    .where(eq(schema.booking.id, bookingId));
}

function refresh(token: string, kind: "k" | "u") {
  revalidatePath(`/${kind}/${token}`);
  revalidatePath("/");
  revalidatePath("/pipeline");
}

/* ------------------------------------------------------------------ */
/*  Kundens åtgärder                                                    */
/* ------------------------------------------------------------------ */

export async function clientDecideCreator(fd: FormData) {
  const token = str(fd, "token");
  const b = await bookingForClientToken(token, str(fd, "bookingId"));
  if (!b) return;
  const approve = str(fd, "decision") === "approve";
  const comment = str(fd, "comment");

  if (approve) {
    await moveStage(b.id, "price_talk", { creatorApproval: "approved" });
    await logEvent(b.id, "Kund", "godkände kreatören – outreach startar");
  } else {
    await requireDb()
      .update(schema.booking)
      .set({ creatorApproval: "rejected", approvalComment: comment || null, updatedAt: new Date() })
      .where(eq(schema.booking.id, b.id));
    await logEvent(b.id, "Kund", `avvisade kreatören${comment ? `: ${comment}` : ""}`);
  }
  refresh(token, "k");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

export async function clientDecideBrief(fd: FormData) {
  const token = str(fd, "token");
  const b = await bookingForClientToken(token, str(fd, "bookingId"));
  if (!b) return;
  const approve = str(fd, "decision") === "approve";
  const comment = str(fd, "comment");

  if (approve) {
    await moveStage(b.id, "brief_approved", { briefApproval: "approved", approvalComment: null });
    await logEvent(b.id, "Kund", "godkände briefen");
  } else {
    await requireDb()
      .update(schema.booking)
      .set({ briefApproval: "changes", approvalComment: comment || null, updatedAt: new Date() })
      .where(eq(schema.booking.id, b.id));
    await logEvent(b.id, "Kund", `begärde ändring på briefen${comment ? `: ${comment}` : ""}`);
  }
  refresh(token, "k");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

export async function clientDecideContent(fd: FormData) {
  const token = str(fd, "token");
  const b = await bookingForClientToken(token, str(fd, "bookingId"));
  if (!b) return;
  const approve = str(fd, "decision") === "approve";
  const comment = str(fd, "comment");

  if (approve) {
    await moveStage(b.id, "content_approved", { contentApproval: "approved", approvalComment: null });
    await logEvent(b.id, "Kund", "godkände materialet");
  } else {
    await requireDb()
      .update(schema.booking)
      .set({ contentApproval: "changes", approvalComment: comment || null, updatedAt: new Date() })
      .where(eq(schema.booking.id, b.id));
    await logEvent(b.id, "Kund", `begärde ändring på materialet${comment ? `: ${comment}` : ""}`);
  }
  refresh(token, "k");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

/** Kunden lägger in spårningslänk när produkten skickats. */
export async function clientSetTracking(fd: FormData) {
  const token = str(fd, "token");
  const b = await bookingForClientToken(token, str(fd, "bookingId"));
  if (!b) return;
  const url = str(fd, "trackingUrl");
  await requireDb()
    .update(schema.booking)
    .set({ trackingUrl: url || null, carrier: str(fd, "carrier") || null, updatedAt: new Date() })
    .where(eq(schema.booking.id, b.id));
  await logEvent(b.id, "Kund", "lade till spårningslänk för produkten");
  refresh(token, "k");
}

/* ------------------------------------------------------------------ */
/*  Kreatörens åtgärder                                                 */
/* ------------------------------------------------------------------ */

export async function creatorConfirmProduct(fd: FormData) {
  const token = str(fd, "token");
  const b = await resolveCreatorToken(token);
  if (!b) return;
  await moveStage(b.id, "product_received", { receivedOn: new Date().toISOString().slice(0, 10) });
  await logEvent(b.id, "Kreatör", "bekräftade att produkten kommit fram");
  refresh(token, "u");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

export async function creatorSubmitContent(fd: FormData) {
  const token = str(fd, "token");
  const b = await resolveCreatorToken(token);
  if (!b) return;

  const links = str(fd, "links")
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const note = str(fd, "note");
  if (!links.length) return;

  await moveStage(b.id, "content_review", {
    contentLinks: links,
    contentNote: note || null,
    contentSubmittedAt: new Date(),
    contentApproval: "pending",
    approvalComment: null,
  });
  await logEvent(b.id, "Kreatör", `skickade in material (${links.length} länk${links.length === 1 ? "" : "ar"})`);
  refresh(token, "u");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

export async function creatorMarkPublished(fd: FormData) {
  const token = str(fd, "token");
  const b = await resolveCreatorToken(token);
  if (!b) return;
  const url = str(fd, "publishedUrl");
  await moveStage(b.id, "published", { publishedUrl: url || null });
  await logEvent(b.id, "Kreatör", "markerade uppdraget som publicerat");
  refresh(token, "u");
  revalidatePath(`/campaigns/${b.campaignId}`);
}

/** Används i tidslinjetexter i de externa vyerna. */
export async function labelFor(stage: Stage) {
  return stageLabel(stage);
}
