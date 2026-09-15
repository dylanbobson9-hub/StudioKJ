import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PortalShell, Card } from "@/components/portal";
import { loadPortal } from "@/lib/client-portal";
import { touchToken } from "@/lib/token-actions";
import { PHASES, phaseOf, STAGE_META } from "@/lib/stages";

export const metadata = { title: "Pipeline", robots: { index: false, follow: false } };

export default async function PortalPipeline({ params }: PageProps<"/k/[token]/pipeline">) {
  const { token } = await params;
  const p = await loadPortal(token);
  if (!p) notFound();
  await touchToken(token);

  return (
    <PortalShell
      token={token}
      active="pipeline"
      title="Pipeline"
      sub={`${p.campaign!.name} · var varje kreatör befinner sig`}
      waiting={p.waiting.length}
    >
      {p.bookings.length === 0 ? (
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Inga kreatörer i flödet ännu.
          </p>
        </Card>
      ) : (
        // Fem faser får inte klippas – de scrollar i sin egen låda i stället.
        <div className="-mx-5 overflow-x-auto px-5 pb-2">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, minmax(150px, 1fr))" }}>
          {PHASES.map((phase) => {
            const inPhase = p.bookings.filter((b) => phaseOf(b.stage) === phase.id);
            return (
              <div key={phase.id}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h2 className="text-[12.5px] font-semibold">{phase.label}</h2>
                  <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {inPhase.length}
                  </span>
                </div>
                <div
                  className="rounded-[13px] border p-2"
                  style={{ borderColor: "var(--line)", background: "var(--surface-2)", minHeight: 64 }}
                >
                  {inPhase.length === 0 ? (
                    <p className="px-1 py-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      —
                    </p>
                  ) : (
                    inPhase.map((b) => (
                      <Link
                        key={b.id}
                        href={`/k/${token}/uppdrag/${b.id}` as Route}
                        className="mb-1.5 block rounded-lg border p-2.5 last:mb-0"
                        style={{
                          background: "var(--surface)",
                          borderColor: b.waiting ? "var(--warn)" : "var(--line)",
                        }}
                      >
                        <div className="text-[12.5px] font-semibold">{b.creator.name}</div>
                        <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
                          {STAGE_META[b.stage].label}
                        </div>
                        {b.addressMissing && (
                          <div className="mt-1 text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                            Adress saknas
                          </div>
                        )}
                        {b.waiting && (
                          <div className="mt-1 text-[11px] font-semibold" style={{ color: "var(--warn)" }}>
                            Väntar på er
                          </div>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      )}
    </PortalShell>
  );
}
