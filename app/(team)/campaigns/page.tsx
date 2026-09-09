import Link from "next/link";
import { PageHead, Card, EmptyState } from "@/components/ui";
import { Progress } from "@/components/pills";
import { ConfirmSubmit, TrashIcon } from "@/components/ConfirmSubmit";
import { listClientsWithCampaigns } from "@/lib/queries";
import { getCurrentMember, can } from "@/lib/auth";
import { createClient, createCampaign, deleteClient, deleteCampaign } from "@/lib/actions";
import { progressPct, fmtDate } from "@/lib/stages";

export default async function CampaignsPage() {
  const [clients, me] = await Promise.all([listClientsWithCampaigns(), getCurrentMember()]);
  const isAdmin = can.managePeople(me);

  return (
    <>
      <PageHead
        title="Kunder & kampanjer"
        sub="Kampanjer grupperade per kund."
        action={
          <Dropdown label="+ Ny kund" primary>
            <form action={createClient} className="flex flex-col gap-3">
              <Field label="Kundnamn" name="name" required placeholder="Företag / varumärke" />
              <Field label="Fakturamejl (valfritt)" name="invoiceEmail" type="email" />
              <PrimaryBtn>Spara kund</PrimaryBtn>
            </form>
          </Dropdown>
        }
      />

      {clients.length === 0 ? (
        <EmptyState title="Inga kunder ännu" hint="Lägg upp din första kund för att skapa kampanjer." />
      ) : (
        clients.map((c) => (
          <section key={c.id} className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="text-[16px] font-semibold">{c.name}</h2>
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                {c.campaigns.length} kampanj{c.campaigns.length === 1 ? "" : "er"}
              </span>
              <span className="flex-1" />

              <Dropdown label="+ Kampanj">
                <form action={createCampaign} className="flex flex-col gap-3">
                  <input type="hidden" name="clientId" value={c.id} />
                  <Field label="Kampanjnamn" name="name" required placeholder="t.ex. Holdmate September" />
                  <div className="flex gap-3">
                    <Field label="Start" name="startsOn" type="date" />
                    <Field label="Marknad" name="market" placeholder="SE, NO" />
                  </div>
                  <div>
                    <Label>Vem skriver briefen?</Label>
                    <select name="briefOwner" className={inputCls} style={inputStyle}>
                      <option value="agency">Byrån</option>
                      <option value="client">Kunden</option>
                    </select>
                  </div>
                  <div>
                    <Label>Standardbrief (valfritt)</Label>
                    <textarea
                      name="brief"
                      rows={3}
                      placeholder="Utgångspunkt för alla kreatörer i kampanjen."
                      className={inputCls}
                      style={inputStyle}
                    />
                  </div>
                  <PrimaryBtn>Skapa kampanj</PrimaryBtn>
                </form>
              </Dropdown>

              {isAdmin && (
                <form action={deleteClient}>
                  <input type="hidden" name="clientId" value={c.id} />
                  <ConfirmSubmit
                    title="Ta bort kund"
                    message={`Ta bort ${c.name}? Går inte att ångra – tar även med ${c.campaigns.length} kampanj(er) och alla uppdrag i dem.`}
                    className="grid size-[30px] place-items-center rounded-lg border"
                    style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
                  >
                    <TrashIcon />
                  </ConfirmSubmit>
                </form>
              )}
            </div>

            {c.campaigns.length > 0 ? (
              <div
                className="overflow-hidden rounded-[13px] border"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {c.campaigns.map((k) => {
                  const avg = k.bookings.length
                    ? Math.round(k.bookings.reduce((s, b) => s + progressPct(b.stage), 0) / k.bookings.length)
                    : 0;
                  return (
                    <div
                      key={k.id}
                      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <Link href={`/campaigns/${k.id}`} className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">
                          {k.name}{" "}
                          <span
                            className="text-[11px] font-normal"
                            style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}
                          >
                            {k.refNo}
                          </span>
                        </div>
                        <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                          {k.bookings.length} kreatör{k.bookings.length === 1 ? "" : "er"} · start {fmtDate(k.startsOn)}
                          {k.market ? ` · ${k.market}` : ""}
                        </div>
                      </Link>

                      {isAdmin && (
                        <form action={deleteCampaign}>
                          <input type="hidden" name="campaignId" value={k.id} />
                          <ConfirmSubmit
                            title="Ta bort kampanj"
                            message={`Ta bort ${k.name}? Går inte att ångra – tar även med ${k.bookings.length} uppdrag.`}
                            className="grid size-[28px] place-items-center rounded-lg border"
                            style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
                          >
                            <TrashIcon size={13} />
                          </ConfirmSubmit>
                        </form>
                      )}

                      <Progress pct={avg} />
                      <span
                        className="w-10 shrink-0 text-right text-[12px] tabular-nums"
                        style={{ color: "var(--muted)" }}
                      >
                        {avg}%
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card>
                <p className="py-3 text-center text-[12.5px]" style={{ color: "var(--muted)" }}>
                  Inga kampanjer ännu.
                </p>
              </Card>
            )}
          </section>
        ))
      )}
    </>
  );
}

/* ---------------------------------------------------------------- */

/** Knapp som fäller ut ett formulär i en panel under sig. */
function Dropdown({ label, primary, children }: { label: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <details className="relative">
      <summary
        className="inline-flex cursor-pointer list-none items-center rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
        style={
          primary
            ? { background: "var(--accent)", color: "var(--accent-ink)", borderColor: "var(--accent)" }
            : { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--line-2)" }
        }
      >
        {label}
      </summary>
      <div
        className="absolute top-full right-0 z-20 mt-2 rounded-[13px] border p-4 shadow-xl"
        style={{
          background: "var(--surface)",
          borderColor: "var(--line-2)",
          width: "min(440px, calc(100vw - 60px))",
        }}
      >
        {children}
      </div>
    </details>
  );
}

const inputCls = "w-full rounded-lg border px-3 py-2 text-[13px]";
const inputStyle = { borderColor: "var(--line-2)", background: "var(--surface)" } as const;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
      {children}
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex-1">
      <Label>{label}</Label>
      <input name={name} type={type} required={required} placeholder={placeholder} className={inputCls} style={inputStyle} />
    </div>
  );
}

function PrimaryBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="mt-1 rounded-lg px-3.5 py-2 text-[13px] font-semibold"
      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
    >
      {children}
    </button>
  );
}
