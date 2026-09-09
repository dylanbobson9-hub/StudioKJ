import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { StagePill, SlaPill, HoldPill, Progress } from "@/components/pills";
import { getCampaign, listBookings } from "@/lib/queries";
import { createBooking } from "@/lib/actions";
import { PHASES, phaseOf, progressPct, ago, fmtDate } from "@/lib/stages";

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const camp = await getCampaign(id);
  if (!camp) notFound();

  const bookings = await listBookings({ campaignId: id });
  const active = bookings.filter((b) => !b.holdActive);
  const dropped = bookings.filter((b) => b.holdActive);

  return (
    <>
      <Link href="/campaigns" className="mb-3 inline-block text-[12.5px]" style={{ color: "var(--muted)" }}>
        ← Alla kampanjer
      </Link>

      <PageHead
        title={camp.name}
        sub={[camp.client.name, camp.refNo, camp.market, camp.startsOn ? `start ${fmtDate(camp.startsOn)}` : null]
          .filter(Boolean)
          .join(" · ")}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {PHASES.map((p) => {
          const n = active.filter((b) => phaseOf(b.stage) === p.id).length;
          return (
            <div
              key={p.id}
              className="flex items-center gap-2 rounded-lg border px-3.5 py-2.5"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              <span className="text-[19px] font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {n}
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--ink-2)" }}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {active.length ? (
        <div
          className="mb-5 overflow-hidden rounded-[13px] border"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {active.map((b) => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {b.creator.preferred && <span style={{ color: "#c99a1e" }}>★ </span>}
                  {b.creator.name}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                  {b.creator.platform ?? "—"}
                </div>
              </div>
              <SlaPill booking={b} />
              <StagePill stage={b.stage} />
              <Progress pct={progressPct(b.stage)} />
              <span className="w-14 shrink-0 text-right text-[12px]" style={{ color: "var(--muted)" }}>
                {ago(b.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="mb-5">
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            Inga kreatörer kopplade ännu.
          </p>
        </Card>
      )}

      {dropped.length > 0 && (
        <details className="mb-5">
          <summary className="cursor-pointer text-[12.5px]" style={{ color: "var(--muted)" }}>
            {dropped.length} utbytt{dropped.length === 1 ? "" : "a"} / pausad{dropped.length === 1 ? "" : "e"}
          </summary>
          <div
            className="mt-2 overflow-hidden rounded-[13px] border"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            {dropped.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                style={{ borderColor: "var(--line)", opacity: 0.7 }}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold">{b.creator.name}</div>
                  <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                    {b.holdNote}
                  </div>
                </div>
                <HoldPill reason={b.holdReason} note={b.holdNote} />
              </Link>
            ))}
          </div>
        </details>
      )}

      <details>
        <summary
          className="inline-flex cursor-pointer rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + Koppla kreatör
        </summary>
        <Card className="mt-3">
          <form action={createBooking} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="campaignId" value={camp.id} />
            <F label="Kreatörens namn" name="creatorName" required />
            <F label="Handle / social" name="handle" placeholder="@namn" />
            <F label="Plattform" name="platform" placeholder="TikTok" />
            <F label="E-post" name="email" type="email" />
            <button
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              Lägg till som Kandidat
            </button>
          </form>
          <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Finns kreatören redan återanvänds profilen. Klockan startar direkt.
          </p>
        </Card>
      </details>
    </>
  );
}

function F({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
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
        style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 180 }}
      />
    </div>
  );
}
