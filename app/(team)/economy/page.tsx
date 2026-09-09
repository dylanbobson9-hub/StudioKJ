import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHead, Card, EmptyState } from "@/components/ui";
import { Pill } from "@/components/pills";
import { getCurrentMember, can } from "@/lib/auth";
import { listCampaigns } from "@/lib/queries";
import { campaignPLs, kr, pct } from "@/lib/econ";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-[19px] font-semibold" style={{ color: tone ?? "var(--ink)" }}>
        {value}
      </div>
    </div>
  );
}

export default async function EconomyPage() {
  const member = await getCurrentMember();
  if (!can.econ(member)) redirect("/");

  const campaigns = await listCampaigns();
  const pls = await campaignPLs(campaigns.map((c) => c.id));

  const totals = campaigns.reduce(
    (t, c) => {
      const p = pls.get(c.id)!;
      return {
        invoiced: t.invoiced + p.invoiced,
        cost: t.cost + p.cost,
        profit: t.profit + p.profit,
        agencyFee: t.agencyFee + p.agencyFee,
        unpriced: t.unpriced + p.unpriced,
      };
    },
    { invoiced: 0, cost: 0, profit: 0, agencyFee: 0, unpriced: 0 },
  );
  const margin = totals.invoiced > 0 ? totals.profit / totals.invoiced : null;

  return (
    <>
      <PageHead title="Ekonomi" sub="Alla belopp exklusive moms. Bara Admin och Ekonomi ser den här sidan." />

      {campaigns.length === 0 ? (
        <EmptyState title="Inga kampanjer ännu" hint="Lägg upp en kampanj så dyker ekonomin upp här." />
      ) : (
        <>
          <Card className="mb-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Fakturerat till kund" value={kr(totals.invoiced)} />
              <Stat label="Våra kostnader" value={kr(totals.cost)} />
              <Stat label="Vinst" value={kr(totals.profit)} tone={totals.profit < 0 ? "var(--crit)" : "var(--good)"} />
              <Stat label="Marginal" value={pct(margin)} />
            </div>
            <p className="mt-3 text-[12px]" style={{ color: "var(--ink-2)" }}>
              Varav <b>{kr(totals.agencyFee)}</b> i byråarvode.
              {totals.unpriced > 0 && (
                <span style={{ color: "var(--warn)" }}>
                  {" "}
                  {totals.unpriced} uppdrag saknar prissättning och räknas som noll.
                </span>
              )}
            </p>
          </Card>

          <div
            className="overflow-x-auto rounded-[13px] border"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 text-left text-[11.5px] font-medium">Kampanj</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-medium">Uppdrag</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-medium">Arvode</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-medium">Fakturerat</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-medium">Kostnad</th>
                  <th className="px-3 py-2.5 text-right text-[11.5px] font-medium">Vinst</th>
                  <th className="px-4 py-2.5 text-right text-[11.5px] font-medium">Marginal</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const p = pls.get(c.id)!;
                  return (
                    <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                      <td className="px-4 py-2.5">
                        <Link href={`/campaigns/${c.id}`} className="font-medium">
                          {c.name}
                        </Link>
                        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {c.client.name}
                          {c.refNo ? ` · ${c.refNo}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "var(--ink-2)" }}>
                        {p.lines.length}
                        {p.unpriced > 0 && (
                          <span style={{ color: "var(--warn)" }} title={`${p.unpriced} utan pris`}>
                            {" "}
                            ({p.unpriced})
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "var(--ink-2)" }}>
                        {p.agencyFee ? kr(p.agencyFee) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">{kr(p.invoiced)}</td>
                      <td className="px-3 py-2.5 text-right" style={{ color: "var(--ink-2)" }}>
                        {kr(p.cost)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-medium"
                        style={{ color: p.profit < 0 ? "var(--crit)" : "var(--good)" }}
                      >
                        {kr(p.profit)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {p.margin == null ? (
                          <span style={{ color: "var(--muted)" }}>—</span>
                        ) : (
                          <Pill tone={p.margin < 0.2 ? "warn" : "neu"}>{pct(p.margin)}</Pill>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[12px]" style={{ color: "var(--muted)" }}>
            Kunden ser bara det fakturerade beloppet – aldrig kreatörsarvoden, utlägg eller marginal.
          </p>
        </>
      )}
    </>
  );
}
