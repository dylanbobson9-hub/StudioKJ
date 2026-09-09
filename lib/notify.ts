import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { sendEmail, emailShell } from "@/lib/email";
import { APP_URL, clientLink, creatorLink } from "@/lib/tokens";

/**
 * Transaktionsmejlen som håller kund och kreatör i rörelse.
 *
 * Två regler gäller överallt här:
 *  1. Ett mejl får aldrig fälla en server action. Allt körs genom `attempt()`
 *     som sväljer felet och loggar det i terminalen istället.
 *  2. Vi mejlar bara till adresser som redan fått en länk utfärdad. Finns
 *     ingen aktiv länk finns heller ingen sida att skicka någon till, så då
 *     hoppar vi tyst över aviseringen.
 */

const BTN =
  "background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600;display:inline-block";
const FINE = "font-size:12px;color:#868ea1";

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${href}" style="${BTN}">${label}</a></p>`;

/** Kommentarer från kund/kreatör hamnar i HTML – släpp inte igenom taggar. */
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const quote = (comment?: string | null) =>
  comment
    ? `<blockquote style="margin:14px 0;padding:10px 14px;border-left:3px solid #e2e6ee;color:#3d4356">${esc(
        comment,
      )}</blockquote>`
    : "";

/* ------------------------------------------------------------------ */
/*  Mottagare                                                           */
/* ------------------------------------------------------------------ */

type Ctx = NonNullable<Awaited<ReturnType<typeof context>>>;

async function context(bookingId: string) {
  const db = requireDb();
  const [row] = await db
    .select({
      b: schema.booking,
      creator: schema.creator,
      campaign: schema.campaign,
      client: schema.client,
    })
    .from(schema.booking)
    .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
    .innerJoin(schema.campaign, eq(schema.booking.campaignId, schema.campaign.id))
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(eq(schema.booking.id, bookingId))
    .limit(1);
  return row ?? null;
}

/** Senaste aktiva kundlänken för kampanjen. */
async function clientTarget(campaignId: string) {
  const [t] = await requireDb()
    .select()
    .from(schema.accessToken)
    .where(
      and(
        eq(schema.accessToken.campaignId, campaignId),
        eq(schema.accessToken.kind, "client"),
        eq(schema.accessToken.revoked, false),
      ),
    )
    .orderBy(desc(schema.accessToken.createdAt))
    .limit(1);
  return t?.email ? { to: t.email, href: clientLink(t.token) } : null;
}

/** Senaste aktiva kreatörslänken för uppdraget. */
async function creatorTarget(bookingId: string, fallbackEmail?: string | null) {
  const [t] = await requireDb()
    .select()
    .from(schema.accessToken)
    .where(
      and(
        eq(schema.accessToken.bookingId, bookingId),
        eq(schema.accessToken.kind, "creator"),
        eq(schema.accessToken.revoked, false),
      ),
    )
    .orderBy(desc(schema.accessToken.createdAt))
    .limit(1);
  if (!t) return null;
  const to = t.email || fallbackEmail;
  return to ? { to, href: creatorLink(t.token) } : null;
}

/** Alla som faktiskt jobbar i pipen – de som ska få en pling internt. */
async function crewEmails() {
  const team = await requireDb().select().from(schema.teamMember);
  return team.filter((m) => m.role === "admin" || m.role === "crew").map((m) => m.email);
}

/* ------------------------------------------------------------------ */
/*  Utskick                                                             */
/* ------------------------------------------------------------------ */

async function logNotice(bookingId: string, text: string) {
  await requireDb().insert(schema.bookingEvent).values({ bookingId, actor: "KJ Studio", text });
}

type Mail = { to: string; subject: string; body: string };

/** Skickar, loggar i tidslinjen, och låter aldrig ett mejlfel bubbla upp. */
async function attempt(bookingId: string, note: string, mail: Mail | null) {
  if (!mail) return;
  try {
    await sendEmail({ to: mail.to, subject: mail.subject, html: emailShell(mail.body) });
    await logNotice(bookingId, `${note} (${mail.to})`);
  } catch (err) {
    console.error(`[notify] ${note} till ${mail.to} misslyckades:`, err);
  }
}

async function attemptCrew(bookingId: string, subject: string, body: string) {
  try {
    const to = await crewEmails();
    if (!to.length) return;
    const html = emailShell(`${body}${button(`${APP_URL}/bookings/${bookingId}`, "Öppna uppdraget")}`);
    await Promise.all(to.map((addr) => sendEmail({ to: addr, subject, html })));
  } catch (err) {
    console.error(`[notify] intern avisering misslyckades:`, err);
  }
}

/* ------------------------------------------------------------------ */
/*  Händelser                                                           */
/* ------------------------------------------------------------------ */

/** Kunden har fått kreatörer att ta ställning till. */
async function creatorsProposed(c: Ctx) {
  const t = await clientTarget(c.campaign.id);
  await attempt(
    c.b.id,
    "aviserade kunden om ny kreatör",
    t && {
      to: t.to,
      subject: `${c.campaign.name}: en kreatör väntar på ert ja`,
      body:
        `<p>Vi har tagit fram <b>${esc(c.creator.name)}</b> till <b>${esc(c.campaign.name)}</b>.</p>
         <p>Gå in och säg ja eller nej – först när ni godkänt börjar vi förhandla och boka.</p>` +
        button(t.href, "Titta på kreatören") +
        `<p style="${FINE}">Snabbt svar här gör att vi hinner byta kreatör om någon tackar nej.</p>`,
    },
  );
}

/** Briefen ligger uppe för kundens godkännande. */
async function briefReady(c: Ctx) {
  const t = await clientTarget(c.campaign.id);
  await attempt(
    c.b.id,
    "aviserade kunden om brief",
    t && {
      to: t.to,
      subject: `${c.campaign.name}: briefen är redo för er`,
      body:
        `<p>Briefen för <b>${esc(c.creator.name)}</b> ligger uppe. Läs igenom och godkänn,
          eller skriv vad som ska ändras.</p>` +
        button(t.href, "Läs briefen") +
        `<p style="${FINE}">Inspelningen startar först när briefen är godkänd.</p>`,
    },
  );
}

/** Kreatören har lämnat in material. */
async function contentReady(c: Ctx) {
  const t = await clientTarget(c.campaign.id);
  await attempt(
    c.b.id,
    "aviserade kunden om material",
    t && {
      to: t.to,
      subject: `${c.campaign.name}: materialet är redo för er`,
      body:
        `<p><b>${esc(c.creator.name)}</b> har lämnat in materialet. Titta igenom och godkänn,
          eller skriv vad som ska justeras.</p>` +
        button(t.href, "Se materialet"),
    },
  );
  await attemptCrew(
    c.b.id,
    `Material inlämnat – ${c.creator.name} · ${c.campaign.name}`,
    `<p><b>${esc(c.creator.name)}</b> har lämnat in material på <b>${esc(c.campaign.name)}</b>
      (${esc(c.client.name)}). Kunden är aviserad.</p>`,
  );
}

/** Kunden har godkänt briefen – kreatören får grönt ljus. */
async function briefApproved(c: Ctx) {
  const t = await creatorTarget(c.b.id, c.creator.email);
  await attempt(
    c.b.id,
    "aviserade kreatören om godkänd brief",
    t && {
      to: t.to,
      subject: `Godkänd brief – dags att spela in för ${c.campaign.name}`,
      body:
        `<p>Hej ${esc(c.creator.name.split(" ")[0])}! ${esc(c.client.name)} har godkänt briefen.
          Du kan sätta igång med inspelningen.</p>` +
        button(t.href, "Öppna uppdraget") +
        `<p style="${FINE}">Räkna med 3–5 dagar för inspelningen. Ladda upp materialet på samma sida när du är klar.</p>`,
    },
  );
}

/** Kunden har godkänt materialet. */
async function contentApproved(c: Ctx) {
  const t = await creatorTarget(c.b.id, c.creator.email);
  await attempt(
    c.b.id,
    "aviserade kreatören om godkänt material",
    t && {
      to: t.to,
      subject: `Materialet är godkänt – ${c.campaign.name}`,
      body:
        `<p>Hej ${esc(c.creator.name.split(" ")[0])}! ${esc(c.client.name)} har godkänt materialet.
          Tack för jobbet – vi hör av oss om publicering och fakturering.</p>` +
        button(t.href, "Öppna uppdraget"),
    },
  );
}

/** Kunden vill ha en ändring på brief eller material. */
async function changesRequested(c: Ctx, what: "brief" | "content", comment?: string | null) {
  const isBrief = what === "brief";
  const thing = isBrief ? "briefen" : "materialet";
  const t = await creatorTarget(c.b.id, c.creator.email);

  await attempt(
    c.b.id,
    `aviserade kreatören om ändring på ${thing}`,
    t && {
      to: t.to,
      subject: `Ändring önskad på ${thing} – ${c.campaign.name}`,
      body:
        `<p>Hej ${esc(c.creator.name.split(" ")[0])}! ${esc(c.client.name)} vill ha en justering på ${thing}
          innan vi går vidare.</p>` +
        quote(comment) +
        button(t.href, "Öppna uppdraget"),
    },
  );

  await attemptCrew(
    c.b.id,
    `Ändring begärd på ${thing} – ${c.creator.name} · ${c.campaign.name}`,
    `<p>${esc(c.client.name)} begärde ändring på ${thing} för <b>${esc(c.creator.name)}</b>.</p>${quote(comment)}`,
  );
}

/**
 * Kunden sa ja till kreatören. Nu startar 24-timmarsklockan på outreach, så
 * det här är plinget som gör att ingen förfrågan blir liggande.
 */
async function creatorApproved(c: Ctx) {
  await attemptCrew(
    c.b.id,
    `Klart att kontakta ${c.creator.name} – ${c.campaign.name}`,
    `<p>${esc(c.client.name)} godkände <b>${esc(c.creator.name)}</b> på <b>${esc(c.campaign.name)}</b>.</p>
     <p><b>Klockan går nu.</b> Får vi inget svar från kreatören inom 24 timmar får du en påminnelse,
       och efter 48 timmar ska kreatören bytas ut.</p>`,
  );
}

/** Kunden tackade nej till kreatören – bara vi behöver veta det. */
async function creatorRejected(c: Ctx, comment?: string | null) {
  await attemptCrew(
    c.b.id,
    `Kunden tackade nej – ${c.creator.name} · ${c.campaign.name}`,
    `<p>${esc(c.client.name)} vill inte ha med <b>${esc(c.creator.name)}</b> på
      <b>${esc(c.campaign.name)}</b>. Dags att ta fram en ersättare.</p>${quote(comment)}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Publikt API                                                         */
/* ------------------------------------------------------------------ */

type Event =
  | { kind: "creators_proposed" }
  | { kind: "brief_ready" }
  | { kind: "content_ready" }
  | { kind: "brief_approved" }
  | { kind: "content_approved" }
  | { kind: "changes_requested"; what: "brief" | "content"; comment?: string | null }
  | { kind: "creator_approved" }
  | { kind: "creator_rejected"; comment?: string | null };

/**
 * Enda ingången. Anropas efter att steget redan sparats, så en trasig
 * mejlserver aldrig kan rulla tillbaka något i databasen.
 */
export async function notify(bookingId: string, e: Event) {
  try {
    const c = await context(bookingId);
    if (!c) return;
    switch (e.kind) {
      case "creators_proposed":
        return await creatorsProposed(c);
      case "brief_ready":
        return await briefReady(c);
      case "content_ready":
        return await contentReady(c);
      case "brief_approved":
        return await briefApproved(c);
      case "content_approved":
        return await contentApproved(c);
      case "changes_requested":
        return await changesRequested(c, e.what, e.comment);
      case "creator_approved":
        return await creatorApproved(c);
      case "creator_rejected":
        return await creatorRejected(c, e.comment);
    }
  } catch (err) {
    console.error("[notify] kunde inte avisera:", err);
  }
}

/** Steg som utlöser ett mejl när teamet flyttar uppdraget manuellt. */
export const STAGE_EVENT: Partial<Record<string, Event>> = {
  creators_review: { kind: "creators_proposed" },
  brief_review: { kind: "brief_ready" },
  content_review: { kind: "content_ready" },
  brief_approved: { kind: "brief_approved" },
  content_approved: { kind: "content_approved" },
};
