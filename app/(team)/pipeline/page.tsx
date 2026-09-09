import Link from "next/link";
import { PageHead, EmptyState } from "@/components/ui";
import { StagePill, SlaPill, HoldPill } from "@/components/pills";
import { listBookings } from "@/lib/queries";
import { PHASES, SLA_TARGET_DAYS, phaseOf, ago } from "@/lib/stages";

export default async function PipelinePage() {
  const bookings = await listBookings();

  return (
    <>
      <PageHead title="Pipeline" sub="Fem faser, alla kampanjer." />

      <div
        className="mb-4 rounded-[13px] border px-4 py-3 text-[12.5px] leading-relaxed"
        style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink-2)" }}
      >
        <b style={{ color: "var(--ink)" }}>Tidsplanen</b> – klockan startar om varje gång ett uppdrag byter steg.
        Kreatör matchas och förfrågan ut inom <b>4 h</b> · svar från kreatören inom <b>24 h</b>, annars påminnelse ·
        inget svar på <b>48 h</b> → <b style={{ color: "var(--crit)" }}>byt ut kreatören</b> · produktion igång dag 2 ·
        inspelning 3–5 dagar · granskning max 1 dag · i rull senast dag {SLA_TARGET_DAYS}.
      </div>

      {bookings.length === 0 ? (
        <EmptyState title="Inga samarbeten ännu" hint="Koppla en kreatör till en kampanj så dyker den upp här." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PHASES.map((p) => {
            const items = bookings.filter((b) => phaseOf(b.stage) === p.id);
            return (
              <div
                key={p.id}
                className="flex w-[250px] shrink-0 flex-col rounded-[13px] border"
                style={{ background: "var(--surface-2)", borderColor: "var(--line)" }}
              >
                <div
                  className="flex items-center justify-between border-b px-3 py-2.5 text-[12px] font-semibold"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span>{p.label}</span>
                  <span className="tabular-nums" style={{ color: "var(--muted)" }}>
                    {items.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  {items.map((b) => (
                    <Link
                      key={b.id}
                      href={`/bookings/${b.id}`}
                      className="flex flex-col gap-2 rounded-lg border p-2.5"
                      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
                    >
                      <div>
                        <div className="truncate text-[13px] font-semibold">
                          {b.creator.preferred && <span style={{ color: "#c99a1e" }}>★ </span>}
                          {b.creator.name}
                        </div>
                        <div className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>
                          {b.campaign.name}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {b.holdActive ? <HoldPill reason={b.holdReason} note={b.holdNote} /> : <StagePill stage={b.stage} />}
                        <SlaPill booking={b} />
                        <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>
                          {ago(b.updatedAt)}
                        </span>
                      </div>
                    </Link>
                  ))}
                  {items.length === 0 && (
                    <p className="px-1 py-3 text-center text-[12px]" style={{ color: "var(--muted)" }}>
                      Tomt
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
