import Link from "next/link";
import { PageHead, Card, EmptyState } from "@/components/ui";
import { StagePill, SlaPill, HoldPill, Progress } from "@/components/pills";
import { listBookings, listCampaigns } from "@/lib/queries";
import { getCurrentMember } from "@/lib/auth";
import { markReminded } from "@/lib/actions";
import { STAGE_META, fmtDur, progressPct, slaFor, slaRank, ago } from "@/lib/stages";

export default async function OverviewPage() {
  const member = await getCurrentMember();
  const [bookings, campaigns] = await Promise.all([listBookings(), listCampaigns()]);
  const firstName = (member?.name ?? "").split(/\s+/)[0] || "där";

  const live = bookings.filter((b) => b.stage !== "done");
  const atClient = live.filter((b) => STAGE_META[b.stage].actor === "client" && !b.holdActive);
  const atCreator = live.filter((b) => STAGE_META[b.stage].actor === "creator" && !b.holdActive);
  const onUs = live.filter((b) => STAGE_META[b.stage].actor === "internal" && !b.holdActive);
  const published = bookings.filter((b) => b.stage === "published" || b.stage === "done");

  const hot = bookings.filter((b) => slaRank(b) >= 0).sort((a, b) => slaRank(b) - slaRank(a));
  const toSwap = hot.filter((b) => slaFor(b)!.level === "swap");

  if (!bookings.length && !campaigns.length) {
    return (
      <>
        <PageHead title={`Hej ${firstName}`} sub="Hela produktionsflödet – vad som rör sig och vad som står stilla." />
        <EmptyState
          title="Inget här ännu"
          hint="Börja med att lägga upp en kund och en kampanj under Kunder & kampanjer."
        />
      </>
    );
  }

  return (
    <>
      <PageHead
        title={`Hej ${firstName}`}
        sub="Hela produktionsflödet – vad som rör sig och vad som står stilla."
      />

      {hot.length > 0 && (
        <div
          className="mb-5 overflow-hidden rounded-[13px] border"
          style={{
            borderColor: toSwap.length ? "var(--crit)" : "var(--warn)",
            borderLeftWidth: 3,
            background: toSwap.length ? "var(--crit-soft)" : "var(--warn-soft)",
          }}
        >
          <div
            className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2.5 text-[13px] font-bold"
            style={{ color: toSwap.length ? "var(--crit)" : "var(--warn)" }}
          >
            Tidsplanen brinner
            <span className="text-[12.5px] font-normal" style={{ color: "var(--ink-2)" }}>
              {toSwap.length
                ? `${toSwap.length} uppdrag har passerat 48 h – byt kreatör`
                : `${hot.length} uppdrag ligger över deadline`}
            </span>
          </div>
          {hot.slice(0, 6).map((b) => {
            const s = slaFor(b)!;
            return (
              <div
                key={b.id}
                className="flex items-center gap-3 border-t px-4 py-2.5"
                style={{ borderColor: "var(--line)" }}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: s.level === "swap" ? "var(--crit)" : "var(--warn)" }}
                />
                <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">
                    {b.creator.name}{" "}
                    <span className="font-normal" style={{ color: "var(--muted)" }}>
                      · {b.campaign.name}
                    </span>
                  </div>
                  <div className="text-[12px]" style={{ color: "var(--ink-2)" }}>
                    {s.what} ·{" "}
                    <b style={{ color: s.level === "swap" ? "var(--crit)" : "var(--warn)" }}>{fmtDur(s.hours)}</b> i
                    steget
                    {s.reminded && " · påminnelse skickad"}
                  </div>
                </Link>
                {s.level === "swap" ? (
                  <Link
                    href={`/bookings/${b.id}`}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                    style={{ background: "var(--crit)", color: "#fff" }}
                  >
                    Byt ut kreatör
                  </Link>
                ) : s.canSwap && !s.reminded ? (
                  <form action={markReminded}>
                    <input type="hidden" name="bookingId" value={b.id} />
                    <button
                      className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
                      style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
                    >
                      Påminnelse skickad
                    </button>
                  </form>
                ) : (
                  <Link href={`/bookings/${b.id}`} className="shrink-0 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                    Öppna
                  </Link>
                )}
              </div>
            );
          })}
          {hot.length > 6 && (
            <div className="border-t px-4 py-2.5 text-[12px]" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
              …och {hot.length - 6} till
            </div>
          )}
        </div>
      )}

      <div className="mb-6 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        <Tile v={live.length} k="Aktiva" d="samarbeten i flödet" />
        <Tile v={hot.length} k="Över deadline" d={toSwap.length ? `${toSwap.length} ska bytas ut` : "mot tidsplanen"} hot={hot.length > 0} />
        <Tile v={atClient.length} k="Hos kund" d="väntar på godkännande" hot={atClient.length > 0} />
        <Tile v={atCreator.length} k="Hos kreatör" d="produkt / material" />
        <Tile v={published.length} k="Publicerat" d="totalt levererat" />
      </div>

      <h2 className="mb-3 text-[16px] font-semibold">
        Kräver en intern insats{" "}
        <span className="text-[12px] font-normal" style={{ color: "var(--muted)" }}>
          {onUs.length}
        </span>
      </h2>
      {onUs.length ? (
        <div className="overflow-hidden rounded-[13px] border" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
          {onUs.map((b) => (
            <Link
              key={b.id}
              href={`/bookings/${b.id}`}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">{b.creator.name}</div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                  {b.campaign.name} · {b.client.name}
                </div>
              </div>
              <SlaPill booking={b} />
              {b.holdActive ? <HoldPill reason={b.holdReason} note={b.holdNote} /> : <StagePill stage={b.stage} />}
              <Progress pct={progressPct(b.stage)} />
              <span className="w-14 shrink-0 text-right text-[12px]" style={{ color: "var(--muted)" }}>
                {ago(b.updatedAt)}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>
            Inget väntar på er just nu.
          </p>
        </Card>
      )}
    </>
  );
}

function Tile({ v, k, d, hot }: { v: number; k: string; d: string; hot?: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-[13px] border p-4"
      style={{ background: "var(--surface)", borderColor: hot ? "var(--warn)" : "var(--line)" }}
    >
      <div
        className="text-[30px] leading-none font-semibold tabular-nums"
        style={{ fontFamily: "var(--font-display)", color: hot ? "var(--warn)" : "var(--ink)" }}
      >
        {v}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
        {k}
      </div>
      <div className="text-[11.5px]" style={{ color: "var(--ink-2)" }}>
        {d}
      </div>
    </div>
  );
}
