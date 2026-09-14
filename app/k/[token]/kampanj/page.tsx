import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PortalShell, Card, StageLine, Bar, CreatorFacts } from "@/components/portal";
import { loadPortal } from "@/lib/client-portal";
import { touchToken } from "@/lib/token-actions";
import { fmtDate } from "@/lib/stages";
import { kr } from "@/lib/econ";

export const metadata = { title: "Kampanjen", robots: { index: false, follow: false } };

export default async function PortalCampaign({ params }: PageProps<"/k/[token]/kampanj">) {
  const { token } = await params;
  const p = await loadPortal(token);
  if (!p) notFound();
  await touchToken(token);

  const camp = p.campaign!;

  return (
    <PortalShell
      token={token}
      active="kampanj"
      title={camp.name}
      sub={`${camp.client.name} · alla kreatörer och vad som gäller`}
      waiting={p.waiting.length}
    >
      {/* --- Villkoren --- */}
      <Card className="mb-4">
        <h2 className="mb-2.5 text-[13.5px] font-semibold">Uppdraget</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
          {(
            [
              ["Marknad", camp.market],
              ["Start", camp.startsOn ? fmtDate(camp.startsOn) : null],
              ["Kreatörer", String(p.bookings.length)],
              [p.pl.fixedPrice ? "Budget" : "Er kostnad", p.pl.invoiced > 0 ? kr(p.pl.invoiced) : null],
            ] as [string, string | null][]
          )
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {k}
                </dt>
                <dd className="text-[13px] font-medium">{v}</dd>
              </div>
            ))}
        </dl>
        {p.pl.invoiced > 0 && (
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Exklusive moms.
            {p.pl.fixedPrice ? " Fast pris för hela leveransen." : " Preliminärt tills kampanjen är klar."}
          </p>
        )}
      </Card>

      {/* --- Den gemensamma briefen --- */}
      {camp.brief && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Brief för kampanjen</h2>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
            {camp.brief}
          </div>
        </Card>
      )}

      {/* --- Kreatörerna, med riktig info --- */}
      {p.bookings.length === 0 ? (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Vi jobbar med urvalet just nu. Så fort vi har kreatörer att föreslå dyker de upp här.
          </p>
        </Card>
      ) : (
        p.bookings.map((b) => (
          <Card key={b.id} className="mb-3">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <Link href={`/k/${token}/uppdrag/${b.id}` as Route} className="text-[15px] font-semibold">
                  {b.creator.name}
                </Link>
                <div className="mt-0.5">
                  <StageLine stage={b.stage} />
                </div>
              </div>
              <div className="w-full sm:w-[130px]">
                <Bar stage={b.stage} />
              </div>
            </div>

            <CreatorFacts creator={b.creator} />

            {b.creator.pitch && (
              <p
                className="mt-3 rounded-lg border p-3 text-[12.5px] leading-relaxed"
                style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink-2)" }}
              >
                {b.creator.pitch}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-4">
              {b.creator.portfolioUrl && (
                <a
                  href={b.creator.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[12.5px] font-medium"
                  style={{ color: "var(--accent)" }}
                >
                  Portfölj ↗
                </a>
              )}
              <Link
                href={`/k/${token}/uppdrag/${b.id}` as Route}
                className="text-[12.5px] font-medium"
                style={{ color: b.waiting ? "var(--warn)" : "var(--accent)" }}
              >
                {b.waiting ? "Väntar på ert svar →" : "Öppna uppdraget →"}
              </Link>
            </div>
          </Card>
        ))
      )}
    </PortalShell>
  );
}
