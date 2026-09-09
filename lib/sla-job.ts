import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { SLA_HOURS } from "@/lib/db/schema";
import { sendEmail, emailShell } from "@/lib/email";
import { APP_URL } from "@/lib/tokens";
import { fmtDur, slaFor, stageLabel } from "@/lib/stages";

/**
 * Plinget utanför appen. Körs av ett schemalagt anrop (Vercel Cron) och
 * skickar ett samlat mejl till crew över allt som spräckt tidsplanen.
 *
 * Varje steg ger som mest två pling:
 *   1. när första deadlinen passeras  → `reminderSentAt` sätts
 *   2. när utbytesdeadlinen passeras  → bara outreach har en sådan
 * Så fort steget byts nollställs klockan och `reminderSentAt` igen.
 */

const SEEN = ["published", "done"] as const;

export type Overdue = {
  bookingId: string;
  creator: string;
  campaign: string;
  client: string;
  stage: string;
  level: "late" | "swap";
  over: number;
  what: string;
  escalation: boolean;
};

export async function findOverdue(now = Date.now()): Promise<Overdue[]> {
  const db = requireDb();
  const rows = await db
    .select({
      b: schema.booking,
      creator: schema.creator.name,
      campaign: schema.campaign.name,
      client: schema.client.name,
    })
    .from(schema.booking)
    .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
    .innerJoin(schema.campaign, eq(schema.booking.campaignId, schema.campaign.id))
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(and(eq(schema.booking.holdActive, false), notInArray(schema.booking.stage, [...SEEN])));

  const out: Overdue[] = [];
  for (const r of rows) {
    const s = slaFor(r.b, now);
    if (!s || s.level === "ok") continue;

    const sentAt = r.b.reminderSentAt ? new Date(r.b.reminderSentAt).getTime() : null;
    if (sentAt != null) {
      // Redan påmint. Enda skälet att pinga igen är att steget dessutom
      // passerat utbytesdeadlinen sedan förra påminnelsen gick ut.
      const escalate = SLA_HOURS[r.b.stage]?.escalate;
      const hoursAtReminder = (sentAt - new Date(r.b.stageSince).getTime()) / 3_600_000;
      if (!escalate || s.escLeft !== 0 || hoursAtReminder >= escalate) continue;
    }

    out.push({
      bookingId: r.b.id,
      creator: r.creator,
      campaign: r.campaign,
      client: r.client,
      stage: stageLabel(r.b.stage),
      level: s.level,
      over: s.over,
      what: s.what,
      escalation: s.level === "swap",
    });
  }
  return out;
}

function row(o: Overdue) {
  const tone = o.level === "swap" ? "#c8322b" : "#b26a00";
  const verdict =
    o.level === "swap"
      ? "Utbytesdeadlinen har passerat – byt kreatör."
      : `Deadlinen passerad med ${fmtDur(o.over)}.`;
  return `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #e2e6ee">
      <div style="font-weight:600">${o.creator} · ${o.campaign}</div>
      <div style="font-size:12.5px;color:#868ea1">${o.client} — ${o.stage}: ${o.what}</div>
      <div style="font-size:12.5px;color:${tone};font-weight:600">${verdict}</div>
      <a href="${APP_URL}/bookings/${o.bookingId}" style="font-size:12.5px;color:#1f6df0">Öppna uppdraget ↗</a>
    </td>
  </tr>`;
}

/** Kör jobbet: hitta försenade uppdrag, mejla crew, markera som påminda. */
export async function runSlaJob(now = Date.now()) {
  const db = requireDb();
  const overdue = await findOverdue(now);
  if (!overdue.length) return { checked: true, overdue: 0, notified: 0 };

  const team = await db.select().from(schema.teamMember);
  const crew = team.filter((m) => m.role === "admin" || m.role === "crew").map((m) => m.email);

  const swaps = overdue.filter((o) => o.level === "swap").length;
  const subject =
    swaps > 0
      ? `Tidsplanen brinner: ${swaps} uppdrag behöver ny kreatör`
      : `${overdue.length} uppdrag ligger efter tidsplanen`;

  if (crew.length) {
    const html = emailShell(
      `<p>Följande uppdrag har passerat sin deadline:</p>
       <table style="width:100%;border-collapse:collapse">${overdue.map(row).join("")}</table>
       <p style="margin-top:20px;font-size:12px;color:#868ea1">
         Klockan nollställs automatiskt så fort uppdraget flyttas till nästa steg.
       </p>`,
    );
    await Promise.all(
      crew.map((to) =>
        sendEmail({ to, subject, html }).catch((err) => console.error(`[sla] mejl till ${to} misslyckades:`, err)),
      ),
    );
  }

  const stamp = new Date(now);
  for (const o of overdue) {
    await db
      .update(schema.booking)
      .set({ reminderSentAt: stamp })
      .where(eq(schema.booking.id, o.bookingId));
    await db.insert(schema.bookingEvent).values({
      bookingId: o.bookingId,
      actor: "KJ Studio",
      text: o.escalation
        ? "utbytesdeadlinen passerad – crew aviserad om byte"
        : `deadline passerad med ${fmtDur(o.over)} – crew påmind`,
    });
  }

  return { checked: true, overdue: overdue.length, notified: crew.length };
}
