import { notFound } from "next/navigation";
import { StagePill, Progress } from "@/components/pills";
import { ExternalShell, Panel } from "@/components/external";
import {
  resolveCreatorToken,
  touchToken,
  creatorConfirmProduct,
  creatorSubmitContent,
  creatorMarkPublished,
} from "@/lib/token-actions";
import { progressPct, stageIndex, fmtDate } from "@/lib/stages";

export const metadata = { title: "Ditt uppdrag", robots: { index: false, follow: false } };

export default async function CreatorView({ params }: PageProps<"/u/[token]">) {
  const { token } = await params;
  const b = await resolveCreatorToken(token);
  if (!b) notFound();
  await touchToken(token);

  const si = stageIndex(b.stage);
  const canSubmit = si >= stageIndex("brief_approved") && si <= stageIndex("content_review");
  const changesRequested = b.contentApproval === "changes";

  return (
    <ExternalShell title="Ditt uppdrag" sub={`${b.campaign.name} · ${b.client.name}`}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <StagePill stage={b.stage} />
        <Progress pct={progressPct(b.stage)} />
      </div>

      {/* Vad som förväntas av dig just nu */}
      {b.stage === "product_sent" && (
        <Panel>
          <p className="mb-3 text-[13.5px] font-semibold">Har produkten kommit fram?</p>
          {b.trackingUrl && (
            <p className="mb-3 text-[13px]">
              Spårning{b.carrier ? ` (${b.carrier})` : ""}:{" "}
              <a href={b.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                följ paketet ↗
              </a>
            </p>
          )}
          <form action={creatorConfirmProduct}>
            <input type="hidden" name="token" value={token} />
            <button
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
              style={{ background: "var(--good)", color: "#fff" }}
            >
              Ja, jag har fått den
            </button>
          </form>
        </Panel>
      )}

      {changesRequested && b.approvalComment && (
        <div
          className="mb-4 rounded-[13px] border p-4"
          style={{ borderColor: "var(--crit)", background: "var(--crit-soft)" }}
        >
          <p className="mb-1 text-[13px] font-semibold" style={{ color: "var(--crit)" }}>
            Kunden vill se en justering
          </p>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            {b.approvalComment}
          </p>
        </div>
      )}

      {/* Brief */}
      <Panel>
        <H>Brief</H>
        {b.brief || b.briefUrl ? (
          <>
            {b.brief && (
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-2)" }}>
                {b.brief}
              </p>
            )}
            {b.briefUrl && (
              <a
                href={b.briefUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-[12.5px] font-medium"
                style={{ color: "var(--accent)" }}
              >
                Öppna brief-dokumentet ↗
              </a>
            )}
          </>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Briefen är inte klar ännu – du får den här.
          </p>
        )}
      </Panel>

      {/* Leverans */}
      <Panel>
        <H>Vad du ska leverera</H>
        <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">
          <Row k="Typ">
            {b.deliverableQty}× {b.deliverableType}
          </Row>
          {b.hooks > 0 && <Row k="Hooks">{b.hooks}</Row>}
          <Row k="Format">{b.rawMaterial ? "Råmaterial – vi redigerar" : "Färdigredigerat"}</Row>
          {b.usageMonths > 0 && <Row k="Annonsrätt">{b.usageMonths} mån</Row>}
          {b.whitelisting && <Row k="Whitelisting">Ja</Row>}
          {b.deliverableNote && <Row k="Notering">{b.deliverableNote}</Row>}
        </dl>
      </Panel>

      {/* Produkt */}
      {(b.productName || b.productAddress || b.sentOn || b.trackingUrl) && (
        <Panel>
          <H>Produkt</H>
          <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">
            {b.productName && <Row k="Produkt">{b.productName}</Row>}
            {b.sentOn && <Row k="Skickad">{fmtDate(b.sentOn)}</Row>}
            {b.receivedOn && <Row k="Mottagen">{fmtDate(b.receivedOn)}</Row>}
            {b.trackingUrl && (
              <Row k="Spårning">
                <a href={b.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                  Följ paketet ↗
                </a>
              </Row>
            )}
          </dl>
        </Panel>
      )}

      {/* Ladda upp material */}
      {canSubmit && (
        <Panel>
          <H>Skicka in material</H>
          {b.uploadFolderUrl && (
            <p className="mb-3 text-[13px]">
              Ladda upp filerna här:{" "}
              <a
                href={b.uploadFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium"
                style={{ color: "var(--accent)" }}
              >
                öppna mappen ↗
              </a>
            </p>
          )}
          <form action={creatorSubmitContent} className="flex flex-col gap-2">
            <input type="hidden" name="token" value={token} />
            <textarea
              name="links"
              rows={3}
              required
              defaultValue={b.contentLinks.join("\n")}
              placeholder={"Klistra in länkarna till materialet – en per rad\nhttps://drive.google.com/…"}
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            />
            <input
              name="note"
              defaultValue={b.contentNote ?? ""}
              placeholder="Kommentar till kunden (valfritt)"
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            />
            <div>
              <button
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {changesRequested ? "Skicka in ny version" : "Skicka in för godkännande"}
              </button>
            </div>
          </form>
        </Panel>
      )}

      {/* Publicering */}
      {b.stage === "scheduled" && (
        <Panel>
          <H>Publicerat?</H>
          <form action={creatorMarkPublished} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="token" value={token} />
            <input
              name="publishedUrl"
              type="url"
              placeholder="Länk till inlägget"
              className="min-w-[240px] flex-1 rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            />
            <button
              className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
              style={{ background: "var(--good)", color: "#fff" }}
            >
              Markera som publicerat
            </button>
          </form>
        </Panel>
      )}

      {b.stage === "content_review" && !changesRequested && (
        <Panel>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Materialet ligger hos kunden för granskning. Vi hör av oss så fort de svarat.
          </p>
        </Panel>
      )}

      <p className="mt-6 text-[12px]" style={{ color: "var(--muted)" }}>
        Frågor? Svara på mejlet från KJ Marketing Sweden så hjälper vi dig.
      </p>
    </ExternalShell>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[11px] font-semibold tracking-[0.11em] uppercase" style={{ color: "var(--muted)" }}>
      {children}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt style={{ color: "var(--muted)" }}>{k}</dt>
      <dd className="m-0">{children}</dd>
    </>
  );
}
