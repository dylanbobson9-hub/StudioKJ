import Link from "next/link";
import { PageHead, Card, EmptyState } from "@/components/ui";
import { Progress } from "@/components/pills";
import { listClientsWithCampaigns } from "@/lib/queries";
import { createClient, createCampaign } from "@/lib/actions";
import { progressPct, fmtDate } from "@/lib/stages";

export default async function CampaignsPage() {
  const clients = await listClientsWithCampaigns();

  return (
    <>
      <PageHead title="Kunder & kampanjer" sub="Kampanjer grupperade per kund." />

      <details className="mb-6">
        <summary
          className="inline-flex cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + Ny kund
        </summary>
        <Card className="mt-3">
          <form action={createClient} className="flex flex-wrap items-end gap-3">
            <Field label="Kundnamn" name="name" required placeholder="Företag / varumärke" />
            <Field label="Fakturamejl (valfritt)" name="invoiceEmail" type="email" />
            <SubmitBtn>Spara kund</SubmitBtn>
          </form>
        </Card>
      </details>

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
            </div>

            {c.campaigns.length > 0 && (
              <div
                className="mb-3 overflow-hidden rounded-[13px] border"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {c.campaigns.map((k) => {
                  const avg = k.bookings.length
                    ? Math.round(k.bookings.reduce((s, b) => s + progressPct(b.stage), 0) / k.bookings.length)
                    : 0;
                  return (
                    <Link
                      key={k.id}
                      href={`/campaigns/${k.id}`}
                      className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                      style={{ borderColor: "var(--line)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold">
                          {k.name}{" "}
                          <span className="text-[11px] font-normal" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                            {k.refNo}
                          </span>
                        </div>
                        <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                          {k.bookings.length} kreatör{k.bookings.length === 1 ? "" : "er"} · start {fmtDate(k.startsOn)}
                          {k.market ? ` · ${k.market}` : ""}
                        </div>
                      </div>
                      <Progress pct={avg} />
                      <span className="w-10 shrink-0 text-right text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>
                        {avg}%
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            <details>
              <summary className="cursor-pointer text-[12.5px] font-semibold" style={{ color: "var(--accent)" }}>
                + Ny kampanj för {c.name}
              </summary>
              <Card className="mt-2">
                <form action={createCampaign} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="clientId" value={c.id} />
                  <Field label="Kampanjnamn" name="name" required placeholder="t.ex. Holdmate September" />
                  <Field label="Start" name="startsOn" type="date" />
                  <Field label="Marknad" name="market" placeholder="SE, NO" />
                  <div>
                    <label className="mb-1.5 block text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
                      Vem skriver briefen?
                    </label>
                    <select
                      name="briefOwner"
                      className="rounded-lg border px-3 py-2 text-[13px]"
                      style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
                    >
                      <option value="agency">Byrån</option>
                      <option value="client">Kunden</option>
                    </select>
                  </div>
                  <SubmitBtn>Skapa kampanj</SubmitBtn>
                </form>
              </Card>
            </details>
          </section>
        ))
      )}
    </>
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
    <div>
      <label className="mb-1.5 block text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border px-3 py-2 text-[13px]"
        style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 200 }}
      />
    </div>
  );
}

function SubmitBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
      style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
    >
      {children}
    </button>
  );
}
