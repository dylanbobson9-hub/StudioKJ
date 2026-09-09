import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { StagePill, SlaPill, HoldPill, Progress } from "@/components/pills";
import { ConfirmSubmit, TrashIcon } from "@/components/ConfirmSubmit";
import { CopyLink } from "@/components/LinkPanel";
import { EconPanel } from "@/components/EconPanel";
import { getCampaign, listBookings, listAccessTokens } from "@/lib/queries";
import { getCurrentMember, can } from "@/lib/auth";
import { createBooking, deleteCampaign, issueClientLink, revokeLink } from "@/lib/actions";
import { APP_URL } from "@/lib/tokens";
import { PHASES, phaseOf, progressPct, ago, fmtDate } from "@/lib/stages";

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const camp = await getCampaign(id);
  if (!camp) notFound();

  const [bookings, links, me] = await Promise.all([
    listBookings({ campaignId: id }),
    listAccessTokens({ campaignId: id }),
    getCurrentMember(),
  ]);
  const isAdmin = can.managePeople(me);
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
        action={
          isAdmin ? (
            <form action={deleteCampaign}>
              <input type="hidden" name="campaignId" value={camp.id} />
              <ConfirmSubmit
                title="Ta bort kampanj"
                message={`Ta bort ${camp.name}? Går inte att ångra – tar även med ${bookings.length} uppdrag.`}
                className="grid size-[32px] place-items-center rounded-lg border"
                style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
              >
                <TrashIcon />
              </ConfirmSubmit>
            </form>
          ) : null
        }
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

      {/* ---- Kundlänk ---- */}
      <Card className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Kundens länk
        </div>
        {links.length ? (
          <div className="flex flex-col gap-2">
            {links.map((l) => (
              <div key={l.token} className="flex flex-wrap items-center gap-2">
                <CopyLink url={`${APP_URL}/k/${l.token}`} />
                <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {l.email ? `mejlad till ${l.email}` : "ej mejlad"} ·{" "}
                  {l.lastSeenAt ? `öppnad ${ago(l.lastSeenAt)}` : "aldrig öppnad"}
                </span>
                <form action={revokeLink}>
                  <input type="hidden" name="token" value={l.token} />
                  <input type="hidden" name="back" value={`/campaigns/${camp.id}`} />
                  <ConfirmSubmit
                    message="Återkalla länken? Kunden kommer inte in längre."
                    className="rounded-lg border px-2.5 py-1.5 text-[12px]"
                    style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
                  >
                    Återkalla
                  </ConfirmSubmit>
                </form>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            Ingen länk skapad ännu. Kunden ser sina kreatörer, vilket steg de är på, och godkänner brief och
            material — utan konto. Kandidater syns inte förrän ni flyttar dem till &quot;Föreslagen till kund&quot;.
          </p>
        )}
        <form action={issueClientLink} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="campaignId" value={camp.id} />
          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Mejla länken till (valfritt)
            </label>
            <input
              name="email"
              type="email"
              placeholder="kontakt@kund.se"
              className="rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 220 }}
            />
          </div>
          <button
            className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
          >
            {links.length ? "Skapa ny länk" : "Skapa kundlänk"}
          </button>
        </form>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        {/* Vanliga vägen: sök i katalogen. */}
        <Link
          href={`/creators?kampanj=${camp.id}`}
          className="inline-flex rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + Koppla kreatör
        </Link>

        <details>
          <summary
            className="inline-flex cursor-pointer list-none rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: "var(--line-2)", color: "var(--ink-2)" }}
          >
            Ny kreatör
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
              För någon som inte står i katalogen. Finns namnet redan återanvänds profilen.
            </p>
          </Card>
        </details>
      </div>

      {can.econ(me) && <EconPanel campaignId={camp.id} />}
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
