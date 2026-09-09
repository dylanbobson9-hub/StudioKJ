"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { getCurrentMember, can } from "@/lib/auth";
import { stageLabel, type Stage } from "@/lib/stages";
import { STAGES } from "@/lib/db/schema";

async function requireStaff() {
  const m = await getCurrentMember();
  if (!m || !can.operate(m)) throw new Error("Behörighet saknas.");
  return m;
}

function actorTag(m: { name: string; role: string }) {
  const label =
    m.role === "admin" ? "Admin" : m.role === "ekonomi" ? "Ekonomi" : m.role === "crew" ? "KJ Crew" : "Redigerare";
  return `${m.name} · ${label}`;
}

async function logEvent(bookingId: string, actor: string, text: string) {
  await requireDb().insert(schema.bookingEvent).values({ bookingId, actor, text });
}

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

/* ------------------------------------------------------------------ */
/*  Kunder & kampanjer                                                  */
/* ------------------------------------------------------------------ */

export async function createClient(fd: FormData) {
  await requireStaff();
  const name = str(fd, "name");
  if (!name) return;
  await requireDb().insert(schema.client).values({ name, invoiceEmail: str(fd, "invoiceEmail") || null });
  revalidatePath("/campaigns");
}

export async function createCampaign(fd: FormData) {
  await requireStaff();
  const db = requireDb();
  const clientId = str(fd, "clientId");
  const name = str(fd, "name");
  if (!clientId || !name) return;

  const rows = await db.select({ refNo: schema.campaign.refNo }).from(schema.campaign);
  const max = rows.reduce((m, r) => {
    const n = /UGC-(\d+)/.exec(r.refNo ?? "");
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);

  const [c] = await db
    .insert(schema.campaign)
    .values({
      clientId,
      name,
      refNo: `UGC-${max + 1}`,
      market: str(fd, "market") || null,
      startsOn: str(fd, "startsOn") || null,
      brief: str(fd, "brief") || null,
      briefOwner: str(fd, "briefOwner") === "client" ? "client" : "agency",
    })
    .returning();
  revalidatePath("/campaigns");
  redirect(`/campaigns/${c.id}`);
}

async function requireAdmin() {
  const m = await getCurrentMember();
  if (!m || !can.managePeople(m)) throw new Error("Bara Admin kan ta bort.");
  return m;
}

/** Tar även med kampanjer, uppdrag, tidslinjer och länkar (FK cascade). */
export async function deleteClient(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "clientId");
  if (!id) return;
  await requireDb().delete(schema.client).where(eq(schema.client.id, id));
  revalidatePath("/campaigns");
  revalidatePath("/");
}

export async function deleteCampaign(fd: FormData) {
  await requireAdmin();
  const id = str(fd, "campaignId");
  if (!id) return;
  await requireDb().delete(schema.campaign).where(eq(schema.campaign.id, id));
  revalidatePath("/campaigns");
  revalidatePath("/pipeline");
  revalidatePath("/");
  redirect("/campaigns");
}

/* ------------------------------------------------------------------ */
/*  Kreatörer & uppdrag                                                 */
/* ------------------------------------------------------------------ */

export async function createBooking(fd: FormData) {
  const m = await requireStaff();
  const db = requireDb();
  const campaignId = str(fd, "campaignId");
  const name = str(fd, "creatorName");
  if (!campaignId || !name) return;

  // Återanvänd befintlig kreatör med samma namn, annars skapa en ny.
  const key = name.toLowerCase();
  const existing = (await db.select().from(schema.creator)).find((c) => c.name.toLowerCase() === key);
  const creatorId =
    existing?.id ??
    (
      await db
        .insert(schema.creator)
        .values({
          name,
          handle: str(fd, "handle") || null,
          platform: str(fd, "platform") || null,
          email: str(fd, "email") || null,
        })
        .returning()
    )[0].id;

  const [camp] = await db.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId)).limit(1);
  const [b] = await db
    .insert(schema.booking)
    .values({ campaignId, creatorId, brief: camp?.brief ?? null, stageSince: new Date() })
    .returning();

  await logEvent(b.id, actorTag(m), "kopplades till kampanjen");
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
}

export async function setStage(fd: FormData) {
  const m = await requireStaff();
  const db = requireDb();
  const id = str(fd, "bookingId");
  const stage = str(fd, "stage") as Stage;
  if (!id || !STAGES.includes(stage)) return;

  const [cur] = await db.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
  if (!cur || cur.stage === stage) return;

  await db
    .update(schema.booking)
    .set({ stage, stageSince: new Date(), reminderSentAt: null, updatedAt: new Date() })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), `flyttade till "${stageLabel(stage)}"`);

  revalidatePath(`/bookings/${id}`);
  revalidatePath(`/campaigns/${cur.campaignId}`);
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function advanceStage(fd: FormData) {
  const db = requireDb();
  const id = str(fd, "bookingId");
  const [cur] = await db.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
  if (!cur) return;
  const next = STAGES[STAGES.indexOf(cur.stage) + 1];
  if (!next) return;
  const nextFd = new FormData();
  nextFd.set("bookingId", id);
  nextFd.set("stage", next);
  await setStage(nextFd);
}

/* ------------------------------------------------------------------ */
/*  Tidsplan                                                            */
/* ------------------------------------------------------------------ */

export async function markReminded(fd: FormData) {
  const m = await requireStaff();
  const id = str(fd, "bookingId");
  if (!id) return;
  await requireDb()
    .update(schema.booking)
    .set({ reminderSentAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), "skickade påminnelse till kreatören");
  revalidatePath("/");
  revalidatePath(`/bookings/${id}`);
}

export async function resetClock(fd: FormData) {
  const m = await requireStaff();
  const id = str(fd, "bookingId");
  if (!id) return;
  await requireDb()
    .update(schema.booking)
    .set({ stageSince: new Date(), reminderSentAt: null, updatedAt: new Date() })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), "startade om klockan för steget");
  revalidatePath("/");
  revalidatePath(`/bookings/${id}`);
}

export async function swapCreator(fd: FormData) {
  const m = await requireStaff();
  const db = requireDb();
  const id = str(fd, "bookingId");
  const reason = str(fd, "reason") || "Svarade inte i tid";
  if (!id) return;

  const [cur] = await db.select().from(schema.booking).where(eq(schema.booking.id, id)).limit(1);
  if (!cur) return;

  await db
    .update(schema.booking)
    .set({
      holdActive: true,
      holdReason: "swapped",
      holdNote: reason,
      reminderSentAt: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), `byttes ut: ${reason}`);

  revalidatePath("/");
  revalidatePath(`/campaigns/${cur.campaignId}`);
  redirect(`/campaigns/${cur.campaignId}`);
}

export async function clearHold(fd: FormData) {
  const m = await requireStaff();
  const id = str(fd, "bookingId");
  if (!id) return;
  await requireDb()
    .update(schema.booking)
    .set({ holdActive: false, holdReason: null, holdNote: null, stageSince: new Date(), updatedAt: new Date() })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), "återupptog uppdraget");
  revalidatePath("/");
  revalidatePath(`/bookings/${id}`);
}

/* ------------------------------------------------------------------ */
/*  Brief                                                               */
/* ------------------------------------------------------------------ */

export async function saveBrief(fd: FormData) {
  const m = await requireStaff();
  const id = str(fd, "bookingId");
  if (!id) return;
  await requireDb()
    .update(schema.booking)
    .set({ brief: str(fd, "brief") || null, briefUrl: str(fd, "briefUrl") || null, updatedAt: new Date() })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), "uppdaterade briefen");
  revalidatePath(`/bookings/${id}`);
}
