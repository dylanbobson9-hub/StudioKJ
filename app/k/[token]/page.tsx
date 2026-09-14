import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PortalShell, Card, StageLine, Bar } from "@/components/portal";
import { loadPortal, portalTimeline } from "@/lib/client-portal";
import { touchToken } from "@/lib/token-actions";
import { fmtDate, ago, progressPct } from "@/lib/stages";
import { kr } from "@/lib/econ";

export const metadata = { title: "Översikt", robots: { index: false, follow: false } };

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

export default async function PortalOverview({ params }: PageProps<"/k/[token]">) {
  const { token } = await params;
  const p = await loadPortal(token);
  if (!p) notFound();
  await touchToken(token);

  const camp = p.campaign!;
  const done = p.bookings.filter((b) => b.stage === "published" || b.stage === "done").length;
  const avg = p.bookings.length
    ? Math.round(p.bookings.reduce((s, b) => s + progressPct(b.stage), 0) / p.bookings.length)
    : 0;
  const timeline = await portalTimeline(p.bookings.map((b) => b.id), 8);

  return (
    <PortalShell
      token={token}
      active="oversikt"
      title={camp.name}
      sub={[camp.client.name, camp.market, camp.startsOn ? `start ${fmtDate(camp.startsOn)}` : null]
        .filter(Boolean)
        .join(" · ")}
      waiting={p.waiting.length}
    >
      {/* --- Vad väntar på er --- */}
      {p.waiting.length > 0 ? (
        <div className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Väntar på er</h2>
          {p.waiting.map((b) => (
            <Link
              key={b.id}
              href={`/k/${token}/uppdrag/${b.id}` as Route}
              className="mb-2 flex items-center gap-3 rounded-[13px] border p-3.5"
              style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold">{b.creator.name}</div>
                <div className="text-[12px]" style={{ color: "var(--warn)" }}>
                  {b.stage === "creators_review"
                    ? "Godkänn kreatören"
                    : b.stage === "brief_review"
                      ? "Godkänn briefen"
                      : "Godkänn materialet"}
                </div>
              </div>
              <span className="text-[13px]" style={{ color: "var(--warn)" }}>
                →
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mb-4">
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            {p.bookings.length
              ? "Inget väntar på er just nu – vi jobbar vidare och hör av oss."
              : "Vi jobbar med urvalet just nu. Så fort vi har kreatörer att föreslå dyker de upp här."}
          </p>
        </Card>
      )}

      {/* --- Läget --- */}
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Kreatörer" value={String(p.bookings.length)} />
          <Stat label="Publicerade" value={`${done} av ${p.bookings.length}`} />
          <Stat label="Genomsnittligt läge" value={`${avg} %`} />
          {p.pl.invoiced > 0 && (
            <Stat label={p.pl.fixedPrice ? "Budget" : "Er kostnad"} value={kr(p.pl.invoiced)} />
          )}
        </div>
        {p.pl.invoiced > 0 && (
          <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Exklusive moms.{p.pl.fixedPrice ? " Fast pris för hela leveransen." : " Preliminärt tills kampanjen är klar."}
          </p>
        )}
      </Card>

      {/* --- Alla uppdrag --- */}
      {p.bookings.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Alla kreatörer</h2>
          <div
            className="overflow-hidden rounded-[13px] border"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {p.bookings.map((b) => (
              <Link
                key={b.id}
                href={`/k/${token}/uppdrag/${b.id}` as Route}
                className="flex flex-wrap items-center gap-3 border-b p-3.5 last:border-b-0"
                style={{ borderColor: "var(--line)" }}
              >
                <div className="min-w-[150px] flex-1">
                  <div className="text-[13.5px] font-semibold">{b.creator.name}</div>
                  <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {[b.creator.platform, b.creator.country].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <StageLine stage={b.stage} />
                <div className="w-full sm:w-[110px]">
                  <Bar stage={b.stage} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* --- Vad som hänt --- */}
      {timeline.length > 0 && (
        <Card>
          <h2 className="mb-2 text-[13.5px] font-semibold">Senast i kampanjen</h2>
          {timeline.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-baseline gap-x-2 border-b py-1.5 text-[12.5px] last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="font-medium">{e.actor}</span>
              <span style={{ color: "var(--ink-2)" }}>{e.text}</span>
              <span className="ml-auto text-[11.5px]" style={{ color: "var(--muted)" }}>
                {ago(e.at)}
              </span>
            </div>
          ))}
        </Card>
      )}
    </PortalShell>
  );
}
