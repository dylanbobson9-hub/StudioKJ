import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmSubmit, TrashIcon } from "@/components/ConfirmSubmit";
import { listInvoices } from "@/lib/queries";
import { campaignPL } from "@/lib/econ";
import { requestInvoice, markInvoiceSent, deleteInvoiceRequest, saveClientBilling } from "@/lib/invoice-actions";
import { ago } from "@/lib/stages";
import type { Client, TeamMember } from "@/lib/db/schema";

const field = { borderColor: "var(--line-2)", background: "var(--surface-2)" } as const;
const kr = (v: number) => `${v.toLocaleString("sv-SE")} kr`;

/**
 * Faktureringen för en kampanj. Hela crew ser den – det är Jacob som vet när
 * det är dags och vad som ska med. Bara Admin och Ekonomi kan markera en
 * faktura som skickad. Beloppen här är vad kunden betalar, aldrig marginal.
 */
export async function InvoicePanel({
  campaignId,
  client,
  me,
  canEcon,
}: {
  campaignId: string;
  client: Client;
  me: TeamMember;
  canEcon: boolean;
}) {
  const [invoices, pl] = await Promise.all([listInvoices({ campaignId }), campaignPL(campaignId)]);

  const sent = invoices.filter((i) => i.status === "sent").reduce((s, i) => s + i.amount, 0);
  const waiting = invoices.filter((i) => i.status === "requested");
  const waitingSum = waiting.reduce((s, i) => s + i.amount, 0);
  const remaining = pl.invoiced > 0 ? pl.invoiced - sent - waitingSum : null;

  const billingMissing = !client.billingName && !client.orgNo && !client.billingAddress && !client.invoiceEmail;

  return (
    <Card className="mt-4">
      <div id="fakturering" className="mb-3 flex flex-wrap items-baseline justify-between gap-2" style={{ scrollMarginTop: 20 }}>
        <h2 className="text-[13.5px] font-semibold">Fakturering</h2>
        <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          Belopp exklusive moms
        </span>
      </div>

      {/* --- Läget --- */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Fakturerat
          </div>
          <div className="text-[15px] font-semibold">{kr(sent)}</div>
        </div>
        <div>
          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
            Väntar på att skickas
          </div>
          <div className="text-[15px] font-semibold" style={{ color: waiting.length ? "var(--warn)" : "var(--ink)" }}>
            {kr(waitingSum)}
          </div>
        </div>
        {remaining !== null && (
          <div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Kvar av {pl.fixedPrice ? "budgeten" : "kampanjens total"}
            </div>
            <div className="text-[15px] font-semibold" style={{ color: remaining < 0 ? "var(--crit)" : "var(--ink)" }}>
              {kr(remaining)}
            </div>
          </div>
        )}
      </div>

      {/* --- Fakturorna --- */}
      {invoices.length > 0 && (
        <div className="mb-4">
          {invoices.map((i) => {
            const isSent = i.status === "sent";
            return (
              <div
                key={i.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t py-2.5"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="min-w-[150px] flex-1">
                  <div className="text-[13.5px] font-semibold">
                    {kr(i.amount)}
                    {i.description && (
                      <span className="ml-2 font-normal" style={{ color: "var(--ink-2)" }}>
                        {i.description}
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    Begärd av {i.requestedByName} {ago(i.requestedAt)}
                    {isSent &&
                      ` · skickad av ${i.sentByName} ${ago(i.sentAt)}${i.invoiceNumber ? ` · nr ${i.invoiceNumber}` : ""}`}
                  </div>
                </div>

                {isSent ? (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                    style={{ background: "var(--good-soft)", color: "var(--good)" }}
                  >
                    ✓ Skickad
                  </span>
                ) : canEcon ? (
                  <form action={markInvoiceSent} className="flex items-center gap-1.5">
                    <input type="hidden" name="invoiceId" value={i.id} />
                    <input
                      name="invoiceNumber"
                      placeholder="Fakturanr"
                      className="w-[92px] rounded-lg border px-2.5 py-1.5 text-[12.5px]"
                      style={field}
                    />
                    <SubmitButton
                      pendingLabel="…"
                      className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white"
                      style={{ background: "var(--good)" }}
                    >
                      Faktura skickad
                    </SubmitButton>
                  </form>
                ) : (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                    style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
                  >
                    Väntar på att skickas
                  </span>
                )}

                {!isSent && (canEcon || i.requestedById === me.id) && (
                  <form action={deleteInvoiceRequest}>
                    <input type="hidden" name="invoiceId" value={i.id} />
                    <ConfirmSubmit
                      message={`Ta bort begäran om ${kr(i.amount)}?`}
                      title="Ta bort begäran"
                      className="rounded-lg border px-2 py-1.5"
                      style={{ borderColor: "var(--line-2)", color: "var(--muted)" }}
                    >
                      <TrashIcon />
                    </ConfirmSubmit>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* --- Ny begäran --- */}
      <form
        action={requestInvoice}
        className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
        style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
      >
        <input type="hidden" name="campaignId" value={campaignId} />
        <div className="w-[130px]">
          <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            Belopp ex moms
          </label>
          <input
            name="amount"
            inputMode="numeric"
            required
            defaultValue={remaining && remaining > 0 ? remaining : ""}
            placeholder="15 250"
            className="w-full rounded-lg border px-3 py-2 text-[13px]"
            style={{ ...field, background: "var(--surface)" }}
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
            Vad avser den
          </label>
          <input
            name="description"
            placeholder="3 kreatörer, 1 video var"
            className="w-full rounded-lg border px-3 py-2 text-[13px]"
            style={{ ...field, background: "var(--surface)" }}
          />
        </div>
        <SubmitButton
          pendingLabel="Skickar…"
          className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {canEcon ? "Lägg till faktura" : "Begär fakturering"}
        </SubmitButton>
      </form>
      {!canEcon && (
        <p className="mt-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
          Admin och Ekonomi får ett mejl med beloppet och kundens fakturauppgifter. Du får ett kvitto när den är skickad.
        </p>
      )}

      {/* --- Fakturauppgifter --- */}
      <details open={billingMissing} className="mt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px] font-semibold">
          Fakturauppgifter för {client.name}
          {billingMissing && (
            <span className="rounded px-1.5 text-[10.5px]" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
              saknas
            </span>
          )}
        </summary>
        <form action={saveClientBilling} className="mt-2.5 grid gap-2 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={client.id} />
          <input type="hidden" name="campaignId" value={campaignId} />
          {(
            [
              ["billingName", "Bolagsnamn", client.billingName, "Zonk E-handel AB"],
              ["orgNo", "Orgnr", client.orgNo, "559505-6119"],
              ["billingAddress", "Fakturaadress", client.billingAddress, "Gatan 4, 821 41 Bollnäs"],
              ["invoiceEmail", "Fakturamejl", client.invoiceEmail, "faktura@kund.se"],
            ] as const
          ).map(([name, label, value, ph]) => (
            <div key={name}>
              <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                {label}
              </label>
              <input
                name={name}
                defaultValue={value ?? ""}
                placeholder={ph}
                className="w-full rounded-lg border px-3 py-2 text-[13px]"
                style={field}
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <SubmitButton
              className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
              style={{ borderColor: "var(--line-2)" }}
            >
              Spara fakturauppgifter
            </SubmitButton>
          </div>
        </form>
      </details>
    </Card>
  );
}
