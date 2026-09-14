import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { PortalShell, Card, StageLine, Bar, CreatorFacts } from "@/components/portal";
import { Decision } from "@/components/external";
import { loadPortal, portalTimeline } from "@/lib/client-portal";
import {
  touchToken,
  clientDecideCreator,
  clientDecideBrief,
  clientDecideContent,
  clientSetTracking,
} from "@/lib/token-actions";
import { ago } from "@/lib/stages";
import { CopyAddress } from "@/components/CopyAddress";

export const metadata = { title: "Uppdrag", robots: { index: false, follow: false } };

export default async function PortalBooking({ params }: PageProps<"/k/[token]/uppdrag/[bookingId]">) {
  const { token, bookingId } = await params;
  const p = await loadPortal(token);
  if (!p) notFound();
  const b = p.bookings.find((x) => x.id === bookingId);
  if (!b) notFound();
  await touchToken(token);

  const timeline = await portalTimeline([b.id], 20);

  return (
    <PortalShell
      token={token}
      active="kampanj"
      title={b.creator.name}
      sub={`${p.campaign!.name} · ${b.deliverableQty} ${b.deliverableType.toLowerCase()}`}
      waiting={p.waiting.length}
    >
      <Link href={`/k/${token}` as Route} className="mb-3 inline-block text-[12.5px]" style={{ color: "var(--accent)" }}>
        ← Översikt
      </Link>

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <StageLine stage={b.stage} />
          </div>
          <div className="w-full sm:w-[140px]">
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

        {b.creator.canFilm && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            <span style={{ color: "var(--muted)" }}>Kan filma: </span>
            {b.creator.canFilm}
          </p>
        )}

        {b.creator.portfolioUrl && (
          <a
            href={b.creator.portfolioUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-[12.5px] font-medium"
            style={{ color: "var(--accent)" }}
          >
            Öppna portfölj ↗
          </a>
        )}

        {/* --- Godkänn kreatör --- */}
        {b.stage === "creators_review" && (
          <Decision
            token={token}
            bookingId={b.id}
            action={clientDecideCreator}
            heading="Vill ni ha med den här kreatören?"
            approveLabel="Godkänn kreatör"
            rejectLabel="Nej tack"
            rejectPlaceholder="Varför passar hen inte? (valfritt)"
          />
        )}
      </Card>

      {/* --- Brief --- */}
      {(b.brief || b.briefUrl) && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Brief</h2>
          <div className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
            {b.brief}
          </div>
          {b.briefUrl && (
            <a
              href={b.briefUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block text-[12.5px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              Öppna brief-dokumentet ↗
            </a>
          )}
          {b.stage === "brief_review" && (
            <Decision
              token={token}
              bookingId={b.id}
              action={clientDecideBrief}
              heading="Godkänner ni briefen?"
              approveLabel="Godkänn brief"
              rejectLabel="Begär ändring"
              rejectPlaceholder="Vad behöver ändras?"
              rejectRequired
            />
          )}
        </Card>
      )}

      {/* --- Material --- */}
      {b.contentLinks.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Material</h2>
          <div className="flex flex-col gap-1.5">
            {b.contentLinks.map((l) => (
              <a
                key={l}
                href={l}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12.5px] break-all"
                style={{ color: "var(--accent)" }}
              >
                {l}
              </a>
            ))}
          </div>
          {b.contentNote && (
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
              {b.contentNote}
            </p>
          )}
          {b.stage === "content_review" && (
            <Decision
              token={token}
              bookingId={b.id}
              action={clientDecideContent}
              heading="Godkänner ni materialet?"
              approveLabel="Godkänn material"
              rejectLabel="Begär ändring"
              rejectPlaceholder="Vad ska justeras?"
              rejectRequired
            />
          )}
        </Card>
      )}

      {b.publishedUrl && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Publicerat</h2>
          <a
            href={b.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] break-all"
            style={{ color: "var(--accent)" }}
          >
            {b.publishedUrl}
          </a>
        </Card>
      )}

      {/* --- Produkt på väg --- */}
      {(b.stage === "confirmed" || b.stage === "product_sent") && (
        <Card className="mb-4">
          <h2 className="mb-2 text-[13.5px] font-semibold">Skickar ni produkten?</h2>

          {b.shipTo ? (
            <div
              className="mb-3 rounded-lg border p-3"
              style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
            >
              <div className="mb-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                Skicka till
              </div>
              <div className="text-[13.5px] font-semibold">{b.shipTo.name}</div>
              <div className="text-[13px] whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
                {b.shipTo.address}
              </div>
              {b.shipTo.shirtSize && (
                <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--muted)" }}>Storlek: </span>
                  {b.shipTo.shirtSize}
                </div>
              )}
              {b.productName && (
                <div className="mt-1 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--muted)" }}>Produkt: </span>
                  {b.productName}
                </div>
              )}
              <CopyAddress
                text={`${b.shipTo.name}
${b.shipTo.address}`}
                className="mt-2 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium"
              />
              <p className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
                Adressen gäller den här leveransen. Kontakta kreatören enbart via KJ Marketing Sweden.
              </p>
            </div>
          ) : (
            <p className="mb-3 text-[12.5px]" style={{ color: "var(--muted)" }}>
              Vi återkommer med leveransadressen så fort kreatören bekräftat.
            </p>
          )}

          <form action={clientSetTracking} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="bookingId" value={b.id} />
            <div className="min-w-[160px] flex-1">
              <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                Spårningslänk
              </label>
              <input
                name="trackingUrl"
                type="url"
                defaultValue={b.trackingUrl ?? ""}
                placeholder="https://…"
                className="w-full rounded-lg border px-3 py-2 text-[13px]"
                style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
              />
            </div>
            <input
              name="carrier"
              defaultValue={b.carrier ?? ""}
              placeholder="Fraktbolag"
              className="w-[130px] rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            />
            <button
              className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            >
              Spara
            </button>
          </form>
        </Card>
      )}

      {b.approvalComment && (
        <Card className="mb-4">
          <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
            <span style={{ color: "var(--muted)" }}>Er senaste kommentar: </span>
            <i>{b.approvalComment}</i>
          </p>
        </Card>
      )}

      {/* --- Tidslinje --- */}
      {timeline.length > 0 && (
        <Card>
          <h2 className="mb-2 text-[13.5px] font-semibold">Historik</h2>
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
