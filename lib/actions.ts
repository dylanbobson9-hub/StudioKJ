"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { getCurrentMember, can } from "@/lib/auth";
import { stageLabel, type Stage } from "@/lib/stages";
import { STAGES, TEAM_ROLES, type TeamRole } from "@/lib/db/schema";
import { newToken, clientLink, creatorLink, APP_URL } from "@/lib/tokens";
import { sendEmail, emailShell } from "@/lib/email";
import { notify, STAGE_EVENT } from "@/lib/notify";

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
/*  Personer                                                            */
/* ------------------------------------------------------------------ */

/**
 * Bjud in någon. `team_member` är hela behörighetsspärren – en adress som
 * inte ligger här kan inte logga in, och inloggningssidan säger medvetet inte
 * om adressen finns eller inte.
 */
export async function addTeamMember(fd: FormData) {
  await requireAdmin();
  const db = requireDb();
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  const role = str(fd, "role") as TeamRole;
  if (!email || !name || !TEAM_ROLES.includes(role)) return;

  const existing = await db.query.teamMember.findFirst({ where: eq(schema.teamMember.email, email) });
  if (existing) return;

  await db.insert(schema.teamMember).values({ email, name, role });

  // Ett trasigt välkomstmejl får inte betyda att personen inte blev upplagd.
  try {
    await sendEmail({
      to: email,
      subject: "Du har fått tillgång till KJ Studio",
      html: emailShell(
        `<p>Hej ${name.split(/\s+/)[0]}! Du är upplagd i KJ Studio – vårt verktyg för att driva
          UGC-produktionerna från kreatörsurval till publicering.</p>
         <p style="margin:20px 0"><a href="${APP_URL}/login"
           style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
           Logga in</a></p>
         <p style="font-size:12px;color:#868ea1">Inget lösenord – skriv den här adressen så mejlas en inloggningslänk.</p>`,
      ),
    });
  } catch (err) {
    console.error("[team] välkomstmejl misslyckades:", err);
  }

  revalidatePath("/team");
}

export async function setTeamRole(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "memberId");
  const role = str(fd, "role") as TeamRole;
  if (!id || !TEAM_ROLES.includes(role)) return;
  // Sista admin får inte degradera sig själv – då låser vi ute alla.
  if (id === me.id) return;
  await requireDb().update(schema.teamMember).set({ role }).where(eq(schema.teamMember.id, id));
  revalidatePath("/team");
}

/** Tar bort tillgången. Sessionerna faller med (FK cascade). */
export async function removeTeamMember(fd: FormData) {
  const me = await requireAdmin();
  const id = str(fd, "memberId");
  if (!id || id === me.id) return;
  await requireDb().delete(schema.teamMember).where(eq(schema.teamMember.id, id));
  revalidatePath("/team");
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

/**
 * Kopplar en kreatör ur katalogen till en kampanj. Den vanliga vägen in —
 * `createBooking` finns kvar för någon som inte står i katalogen ännu.
 */
export async function attachCreator(fd: FormData) {
  const m = await requireStaff();
  const db = requireDb();
  const campaignId = str(fd, "campaignId");
  const creatorId = str(fd, "creatorId");
  if (!campaignId || !creatorId) return;

  const [dup] = await db
    .select({ id: schema.booking.id })
    .from(schema.booking)
    .where(and(eq(schema.booking.campaignId, campaignId), eq(schema.booking.creatorId, creatorId)))
    .limit(1);
  if (dup) redirect(`/campaigns/${campaignId}`);

  const [camp] = await db.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId)).limit(1);
  if (!camp) return;

  const [b] = await db
    .insert(schema.booking)
    .values({ campaignId, creatorId, brief: camp.brief ?? null, stageSince: new Date() })
    .returning();
  await logEvent(b.id, actorTag(m), "kopplades till kampanjen");

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/");
  redirect(`/campaigns/${campaignId}`);
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

  // Vissa steg är hela poängen med länkarna – då ska mottagaren få ett mejl.
  const event = STAGE_EVENT[stage];
  if (event) await notify(id, event);

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
/*  Länkar till kund och kreatör                                        */
/* ------------------------------------------------------------------ */

export async function issueClientLink(fd: FormData) {
  await requireStaff();
  const db = requireDb();
  const campaignId = str(fd, "campaignId");
  const email = str(fd, "email");
  if (!campaignId) return;

  const token = newToken();
  await db.insert(schema.accessToken).values({ token, kind: "client", campaignId, email: email || null });

  const [camp] = await db.select().from(schema.campaign).where(eq(schema.campaign.id, campaignId)).limit(1);
  if (email) {
    await sendEmail({
      to: email,
      subject: `Följ ${camp?.name ?? "kampanjen"} – KJ Studio`,
      html: emailShell(
        `<p>Här är er länk till <b>${camp?.name ?? "kampanjen"}</b>. Ni ser vilka kreatörer som är på gång,
          vilket steg var och en ligger i, och godkänner brief och material när det är er tur.</p>
         <p style="margin:20px 0"><a href="${clientLink(token)}"
           style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
           Öppna kampanjen</a></p>
         <p style="font-size:12px;color:#868ea1">Länken är personlig – dela den inte vidare.</p>`,
      ),
    });
  }
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function issueCreatorLink(fd: FormData) {
  await requireStaff();
  const db = requireDb();
  const bookingId = str(fd, "bookingId");
  const email = str(fd, "email");
  if (!bookingId) return;

  const token = newToken();
  await db.insert(schema.accessToken).values({ token, kind: "creator", bookingId, email: email || null });

  const [b] = await db.select().from(schema.booking).where(eq(schema.booking.id, bookingId)).limit(1);
  const [camp] = b
    ? await db.select().from(schema.campaign).where(eq(schema.campaign.id, b.campaignId)).limit(1)
    : [null];
  if (email) {
    await sendEmail({
      to: email,
      subject: `Ditt uppdrag för ${camp?.name ?? "en kampanj"} – KJ Studio`,
      html: emailShell(
        `<p>Här är din sida för uppdraget <b>${camp?.name ?? ""}</b>. Där hittar du briefen, info om produkten
          och stället där du laddar upp materialet.</p>
         <p style="margin:20px 0"><a href="${creatorLink(token)}"
           style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
           Öppna uppdraget</a></p>
         <p style="font-size:12px;color:#868ea1">Länken är personlig – dela den inte vidare.</p>`,
      ),
    });
  }
  revalidatePath(`/bookings/${bookingId}`);
}

export async function revokeLink(fd: FormData) {
  await requireStaff();
  const token = str(fd, "token");
  if (!token) return;
  await requireDb()
    .update(schema.accessToken)
    .set({ revoked: true })
    .where(eq(schema.accessToken.token, token));
  revalidatePath(str(fd, "back") || "/campaigns");
}

/* ------------------------------------------------------------------ */
/*  Produkt & frakt                                                     */
/* ------------------------------------------------------------------ */

export async function setProduct(fd: FormData) {
  const m = await requireStaff();
  const id = str(fd, "bookingId");
  if (!id) return;
  await requireDb()
    .update(schema.booking)
    .set({
      productName: str(fd, "productName") || null,
      productAddress: str(fd, "productAddress") || null,
      carrier: str(fd, "carrier") || null,
      trackingUrl: str(fd, "trackingUrl") || null,
      sentOn: str(fd, "sentOn") || null,
      uploadFolderUrl: str(fd, "uploadFolderUrl") || null,
      updatedAt: new Date(),
    })
    .where(eq(schema.booking.id, id));
  await logEvent(id, actorTag(m), "uppdaterade produkt- och leveransinfo");
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
