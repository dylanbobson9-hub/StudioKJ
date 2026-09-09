import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { StagePill, HoldPill, Progress } from "@/components/pills";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { CopyLink } from "@/components/LinkPanel";
import { getBooking, listBookingEvents, listAccessTokens } from "@/lib/queries";
import {
  setStage,
  advanceStage,
  markReminded,
  resetClock,
  swapCreator,
  clearHold,
  saveBrief,
  setProduct,
  issueCreatorLink,
  revokeLink,
} from "@/lib/actions";
import { APP_URL } from "@/lib/tokens";
import { PHASES, STAGE_META, STAGES, fmtDur, progressPct, slaFor, stageIndex, ago } from "@/lib/stages";

export default async function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const b = await getBooking(id);
  if (!b) notFound();

  const [events, links] = await Promise.all([listBookingEvents(id), listAccessTokens({ bookingId: id })]);
  const sla = slaFor(b);
  const next = STAGES[stageIndex(b.stage) + 1];

  return (
    <>
      <Link href={`/campaigns/${b.campaign.id}`} className="mb-3 inline-block text-[12.5px]" style={{ color: "var(--muted)" }}>
        ← {b.campaign.name}
      </Link>

      <PageHead
        title={b.creator.name}
        sub={[b.campaign.name, b.client.name, b.creator.platform].filter(Boolean).join(" · ")}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {b.holdActive ? <HoldPill reason={b.holdReason} note={b.holdNote} /> : <StagePill stage={b.stage} />}
        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
          {STAGE_META[b.stage].actor === "client"
            ? "Väntar på kund"
            : STAGE_META[b.stage].actor === "creator"
              ? "Väntar på kreatör"
              : STAGE_META[b.stage].actor === "internal"
                ? "Vårt bord"
                : "—"}
        </span>
        <Progress pct={progressPct(b.stage)} />
      </div>

      {/* ---- Tidsplan ---- */}
      {sla && (
        <div
          className="mb-5 rounded-[13px] border p-4"
          style={{
            borderColor: sla.level === "swap" ? "var(--crit)" : sla.level === "late" ? "var(--warn)" : "var(--line)",
            background:
              sla.level === "swap" ? "var(--crit-soft)" : sla.level === "late" ? "var(--warn-soft)" : "var(--surface)",
          }}
        >
          <div className="mb-1.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
            Tidsplan
          </div>
          <div className="text-[13.5px] font-semibold">{sla.what}</div>
          <div className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
            {sla.level === "ok" ? (
              <>
                {fmtDur(sla.hours)} i det här steget · <b>{fmtDur(sla.left)} kvar</b> till deadline
              </>
            ) : sla.level === "late" ? (
              <>
                <b style={{ color: "var(--warn)" }}>{fmtDur(sla.over)} över deadline</b>
                {sla.escLeft != null && <> · byts ut om {fmtDur(sla.escLeft)}</>}
              </>
            ) : (
              <b style={{ color: "var(--crit)" }}>
                {fmtDur(sla.hours)} utan svar – enligt rutinen ska kreatören bytas ut nu
              </b>
            )}
            {sla.reminded && (
              <div style={{ color: "var(--muted)" }}>Påminnelse skickad {ago(b.reminderSentAt)}</div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sla.canSwap && !sla.reminded && sla.level !== "ok" && (
              <form action={markReminded}>
                <input type="hidden" name="bookingId" value={b.id} />
                <Btn>Påminnelse skickad</Btn>
              </form>
            )}
            <form action={resetClock}>
              <input type="hidden" name="bookingId" value={b.id} />
              <Btn>Starta om klockan</Btn>
            </form>
          </div>

          {sla.canSwap && sla.level !== "ok" && (
            <form action={swapCreator} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="bookingId" value={b.id} />
              <div>
                <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                  Orsak (hamnar i tidslinjen)
                </label>
                <input
                  name="reason"
                  defaultValue="Svarade inte inom 48 h"
                  className="rounded-lg border px-3 py-2 text-[13px]"
                  style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 240 }}
                />
              </div>
              <button
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                style={{ background: "var(--crit)", color: "#fff" }}
              >
                Byt ut kreatör
              </button>
            </form>
          )}
        </div>
      )}

      {b.holdActive && (
        <Card className="mb-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 text-[13px]">
              <b>{b.holdReason === "swapped" ? "Utbytt" : "Pausad"}.</b> {b.holdNote}
            </div>
            <form action={clearHold}>
              <input type="hidden" name="bookingId" value={b.id} />
              <Btn>Återuppta</Btn>
            </form>
          </div>
        </Card>
      )}

      {/* ---- Flytta i flödet ---- */}
      <Card className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Flytta i flödet
        </div>
        <form action={setStage} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="bookingId" value={b.id} />
          <select
            name="stage"
            key={b.stage}
            defaultValue={b.stage}
            className="rounded-lg border px-3 py-2 text-[13px]"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 260 }}
          >
            {PHASES.map((p) => (
              <optgroup key={p.id} label={p.label}>
                {p.stages.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_META[s].label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Btn>Flytta</Btn>
        </form>
        {next && (
          <form action={advanceStage} className="mt-2">
            <input type="hidden" name="bookingId" value={b.id} />
            <button
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
            >
              → {STAGE_META[next].label}
            </button>
          </form>
        )}
      </Card>

      {/* ---- Kreatörens länk ---- */}
      <Card className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Kreatörens länk
        </div>
        {links.length ? (
          <div className="flex flex-col gap-2">
            {links.map((l) => (
              <div key={l.token} className="flex flex-wrap items-center gap-2">
                <CopyLink url={`${APP_URL}/u/${l.token}`} />
                <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  {l.email ? `mejlad till ${l.email}` : "ej mejlad"} ·{" "}
                  {l.lastSeenAt ? `öppnad ${ago(l.lastSeenAt)}` : "aldrig öppnad"}
                </span>
                <form action={revokeLink}>
                  <input type="hidden" name="token" value={l.token} />
                  <input type="hidden" name="back" value={`/bookings/${b.id}`} />
                  <ConfirmSubmit
                    message="Återkalla länken? Kreatören kommer inte in längre."
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
            Kreatören ser briefen, produkt- och trackinginfo, och laddar upp sitt material här — utan konto.
          </p>
        )}
        <form action={issueCreatorLink} className="mt-3 flex flex-wrap items-end gap-2">
          <input type="hidden" name="bookingId" value={b.id} />
          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Mejla länken till
            </label>
            <input
              name="email"
              type="email"
              defaultValue={b.creator.email ?? ""}
              placeholder="kreator@mail.com"
              className="rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 220 }}
            />
          </div>
          <button
            className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
          >
            {links.length ? "Skapa ny länk" : "Skapa kreatörslänk"}
          </button>
        </form>
      </Card>

      {/* ---- Produkt & uppladdning ---- */}
      <Card className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Produkt, frakt &amp; uppladdning
        </div>
        <form action={setProduct} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="bookingId" value={b.id} />
          <Fld label="Produkt" name="productName" defaultValue={b.productName} placeholder="Vad skickas" />
          <Fld label="Fraktbolag" name="carrier" defaultValue={b.carrier} width={130} />
          <Fld label="Spårningslänk" name="trackingUrl" type="url" defaultValue={b.trackingUrl} placeholder="https://…" />
          <Fld label="Skickad" name="sentOn" type="date" defaultValue={b.sentOn} width={150} />
          <Fld
            label="Uppladdningsmapp (Drive)"
            name="uploadFolderUrl"
            type="url"
            defaultValue={b.uploadFolderUrl}
            placeholder="https://drive.google.com/…"
          />
          <Fld label="Leveransadress" name="productAddress" defaultValue={b.productAddress} />
          <Btn>Spara</Btn>
        </form>
      </Card>

      {/* ---- Material från kreatören ---- */}
      {b.contentLinks.length > 0 && (
        <Card className="mb-5">
          <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
            Inskickat material
          </div>
          <div className="flex flex-col gap-1.5">
            {b.contentLinks.map((l) => (
              <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="text-[12.5px] break-all" style={{ color: "var(--accent)" }}>
                {l}
              </a>
            ))}
          </div>
          {b.contentNote && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              {b.contentNote}
            </p>
          )}
        </Card>
      )}

      {/* ---- Brief ---- */}
      <Card className="mb-5">
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Brief
        </div>
        <form action={saveBrief} className="flex flex-col gap-2">
          <input type="hidden" name="bookingId" value={b.id} />
          <textarea
            name="brief"
            defaultValue={b.brief ?? ""}
            rows={5}
            placeholder="Skriv eller klistra in briefen…"
            className="rounded-lg border px-3 py-2 text-[13px] leading-relaxed"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
          />
          <input
            name="briefUrl"
            type="url"
            defaultValue={b.briefUrl ?? ""}
            placeholder="…eller länk till brief-dokument"
            className="rounded-lg border px-3 py-2 text-[13px]"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
          />
          <div>
            <Btn>Spara brief</Btn>
          </div>
        </form>
      </Card>

      {/* ---- Tidslinje ---- */}
      <Card>
        <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
          Tidslinje
        </div>
        {events.length ? (
          <div className="flex flex-col">
            {events.map((e) => (
              <div
                key={e.id}
                className="flex gap-3 border-b py-2 text-[12.5px] last:border-b-0"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="w-20 shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>
                  {ago(e.at)}
                </span>
                <span style={{ color: "var(--ink-2)" }}>
                  <b style={{ color: "var(--ink)" }}>{e.actor}</b> {e.text}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Inget har hänt ännu.
          </p>
        )}
      </Card>
    </>
  );
}

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
      style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink)" }}
    >
      {children}
    </button>
  );
}

function Fld({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  width = 200,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  placeholder?: string;
  width?: number;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
      </label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="rounded-lg border px-3 py-2 text-[13px]"
        style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: width }}
      />
    </div>
  );
}
