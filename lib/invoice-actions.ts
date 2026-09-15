"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { getCurrentMember, can } from "@/lib/auth";
import { sendEmail, emailShell } from "@/lib/email";
import { APP_URL } from "@/lib/tokens";

/**
 * Faktureringsflödet. Ersätter två Asana-kommentarer:
 *
 *   Jacob:  "@Kevin Fakturera 15250 kr ex.moms – 3 kreatörer 1 vid var"
 *   Kevin:  "FAKTURA SKICKAD"
 *
 * Den som driver kampanjen begär, Admin/Ekonomi skickar. Båda sidor får ett
 * mejl, och det som väntar ligger överst i Ekonomi med hur länge det legat.
 */

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

const kr = (v: number) => `${v.toLocaleString("sv-SE")} kr`;

function refresh(campaignId: string) {
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/economy");
  revalidatePath("/");
}

async function campaignWithClient(campaignId: string) {
  const [row] = await requireDb()
    .select({ c: schema.campaign, client: schema.client })
    .from(schema.campaign)
    .innerJoin(schema.client, eq(schema.campaign.clientId, schema.client.id))
    .where(eq(schema.campaign.id, campaignId))
    .limit(1);
  return row ?? null;
}

/** Fakturauppgifterna som ett block, eller en tydlig varning om de fattas. */
function billingBlock(client: typeof schema.client.$inferSelect) {
  const lines = [client.billingName, client.orgNo, client.billingAddress, client.invoiceEmail].filter(Boolean);
  if (!lines.length) {
    return `<p style="color:#9a6212;font-size:13px"><b>Fakturauppgifter saknas</b> för ${client.name} – fyll i dem på kampanjsidan.</p>`;
  }
  return `<div style="margin:14px 0;padding:12px 14px;background:#f5f6f9;border-radius:9px;font-size:13px;line-height:1.55">
    ${lines.map((l) => String(l).replace(/</g, "&lt;")).join("<br>")}
  </div>`;
}

export async function requestInvoice(fd: FormData) {
  const m = await getCurrentMember();
  if (!m || !can.operate(m)) throw new Error("Behörighet saknas.");

  const campaignId = str(fd, "campaignId");
  const amount = Math.round(Number(str(fd, "amount").replace(/\s|kr/gi, "").replace(",", ".")));
  const description = str(fd, "description") || null;
  if (!campaignId || !Number.isFinite(amount) || amount <= 0) return;

  const row = await campaignWithClient(campaignId);
  if (!row) return;
  const db = requireDb();

  // Samma belopp, samma kampanj, samma minut = ett dubbelklick.
  const recent = await db
    .select({ id: schema.invoice.id, at: schema.invoice.requestedAt })
    .from(schema.invoice)
    .where(and(eq(schema.invoice.campaignId, campaignId), eq(schema.invoice.amount, amount)));
  if (recent.some((r) => Date.now() - r.at.getTime() < 60_000)) return refresh(campaignId);

  await db.insert(schema.invoice).values({
    campaignId,
    amount,
    description,
    requestedById: m.id,
    requestedByName: m.name,
  });

  // Mejla alla som kan skicka fakturor – idag Kevin.
  try {
    const team = await db.select().from(schema.teamMember);
    const billers = team.filter((t) => can.econ(t) && t.id !== m.id);
    const html = emailShell(
      `<p><b>${m.name}</b> vill att <b>${row.client.name}</b> faktureras.</p>
       <p style="font-size:26px;font-weight:700;margin:6px 0">${kr(amount)} <span style="font-size:14px;font-weight:500;color:#868ea1">ex moms</span></p>
       ${description ? `<p style="margin:0 0 4px;color:#525a6b">${description.replace(/</g, "&lt;")}</p>` : ""}
       <p style="margin:0;font-size:12px;color:#868ea1">${row.c.name}${row.c.refNo ? ` · ${row.c.refNo}` : ""}</p>
       ${billingBlock(row.client)}
       <p style="margin:20px 0"><a href="${APP_URL}/campaigns/${campaignId}#fakturering"
         style="background:#1f6df0;color:#fff;padding:11px 20px;border-radius:9px;text-decoration:none;font-weight:600">
         Markera som skickad</a></p>`,
    );
    await Promise.all(
      billers.map((b) =>
        sendEmail({ to: b.email, subject: `Fakturera ${row.client.name}: ${kr(amount)} ex moms`, html }),
      ),
    );
  } catch (err) {
    console.error("[faktura] kunde inte mejla:", err);
  }

  refresh(campaignId);
}

export async function markInvoiceSent(fd: FormData) {
  const m = await getCurrentMember();
  if (!m || !can.econ(m)) throw new Error("Bara Admin och Ekonomi skickar fakturor.");

  const id = str(fd, "invoiceId");
  if (!id) return;
  const db = requireDb();
  const [inv] = await db.select().from(schema.invoice).where(eq(schema.invoice.id, id)).limit(1);
  if (!inv || inv.status === "sent") return;

  await db
    .update(schema.invoice)
    .set({
      status: "sent",
      sentById: m.id,
      sentByName: m.name,
      sentAt: new Date(),
      invoiceNumber: str(fd, "invoiceNumber") || null,
    })
    .where(eq(schema.invoice.id, id));

  // Kvittot till den som bad om det – det som idag är "FAKTURA SKICKAD".
  try {
    const row = await campaignWithClient(inv.campaignId);
    const [requester] = inv.requestedById
      ? await db.select().from(schema.teamMember).where(eq(schema.teamMember.id, inv.requestedById)).limit(1)
      : [];
    if (row && requester && requester.id !== m.id) {
      await sendEmail({
        to: requester.email,
        subject: `Faktura skickad: ${row.client.name} ${kr(inv.amount)}`,
        html: emailShell(
          `<p style="font-size:18px;font-weight:700;margin:0 0 6px">✓ Faktura skickad</p>
           <p><b>${row.client.name}</b> har fakturerats <b>${kr(inv.amount)}</b> ex moms.</p>
           ${inv.description ? `<p style="color:#525a6b">${inv.description.replace(/</g, "&lt;")}</p>` : ""}
           <p style="font-size:12px;color:#868ea1">${m.name}${str(fd, "invoiceNumber") ? ` · fakturanr ${str(fd, "invoiceNumber")}` : ""}</p>`,
        ),
      });
    }
  } catch (err) {
    console.error("[faktura] kunde inte mejla kvitto:", err);
  }

  refresh(inv.campaignId);
}

/** Bara en begäran som inte skickats än kan tas bort – en skickad faktura finns. */
export async function deleteInvoiceRequest(fd: FormData) {
  const m = await getCurrentMember();
  if (!m || !can.operate(m)) throw new Error("Behörighet saknas.");
  const id = str(fd, "invoiceId");
  if (!id) return;
  const db = requireDb();
  const [inv] = await db.select().from(schema.invoice).where(eq(schema.invoice.id, id)).limit(1);
  if (!inv || inv.status !== "requested") return;
  // Crew får ta bort sina egna felskrivningar, Admin/Ekonomi alla.
  if (!can.econ(m) && inv.requestedById !== m.id) return;
  await db.delete(schema.invoice).where(eq(schema.invoice.id, id));
  refresh(inv.campaignId);
}

export async function saveClientBilling(fd: FormData) {
  const m = await getCurrentMember();
  if (!m || !can.operate(m)) throw new Error("Behörighet saknas.");
  const clientId = str(fd, "clientId");
  if (!clientId) return;
  await requireDb()
    .update(schema.client)
    .set({
      billingName: str(fd, "billingName") || null,
      orgNo: str(fd, "orgNo") || null,
      billingAddress: str(fd, "billingAddress") || null,
      invoiceEmail: str(fd, "invoiceEmail").toLowerCase() || null,
    })
    .where(eq(schema.client.id, clientId));
  const back = str(fd, "campaignId");
  if (back) refresh(back);
}
