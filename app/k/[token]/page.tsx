import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireDb, schema } from "@/lib/db";
import { StagePill, Progress } from "@/components/pills";
import { Disclaimer, ExternalShell, Panel, Decision } from "@/components/external";
import { resolveClientToken, touchToken, clientDecideCreator, clientDecideBrief, clientDecideContent, clientSetTracking } from "@/lib/token-actions";
import { progressPct, fmtDate } from "@/lib/stages";

export const metadata = { title: "Kampanj", robots: { index: false, follow: false } };

export default async function ClientView({ params }: PageProps<"/k/[token]">) {
  const { token } = await params;
  const camp = await resolveClientToken(token);
  if (!camp) notFound();
  await touchToken(token);

  const db = requireDb();
  const rows = await db
    .select({ b: schema.booking, creator: schema.creator })
    .from(schema.booking)
    .innerJoin(schema.creator, eq(schema.booking.creatorId, schema.creator.id))
    .where(eq(schema.booking.campaignId, camp.id));

  // Kandidater är interna tills byrån föreslår dem. Utbytta göms också.
  const bookings = rows
    .map((r) => ({ ...r.b, creator: r.creator }))
    .filter((b) => b.stage !== "sourcing" && !b.holdActive)
    .sort((a, b) => a.creator.name.localeCompare(b.creator.name, "sv"));

  const waiting = bookings.filter(
    (b) => b.stage === "creators_review" || b.stage === "brief_review" || b.stage === "content_review",
  );

  return (
    <ExternalShell
      title={camp.name}
      sub={[camp.client.name, camp.market, camp.startsOn ? `start ${fmtDate(camp.startsOn)}` : null]
        .filter(Boolean)
        .join(" · ")}
    >
      {waiting.length > 0 && (
        <p
          className="mb-5 rounded-lg border px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--warn)", background: "var(--warn-soft)", color: "var(--warn)" }}
        >
          <b>{waiting.length}</b> {waiting.length === 1 ? "sak väntar" : "saker väntar"} på ert godkännande.
        </p>
      )}

      {bookings.length === 0 ? (
        <Panel>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>
            Vi jobbar med urvalet just nu. Så fort vi har kreatörer att föreslå dyker de upp här.
          </p>
        </Panel>
      ) : (
        bookings.map((b) => (
          <Panel key={b.id}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold">{b.creator.name}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  {[b.creator.platform, b.creator.country].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <StagePill stage={b.stage} />
              <Progress pct={progressPct(b.stage)} />
            </div>

            {b.creator.portfolioUrl && (
              <a
                href={b.creator.portfolioUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-3 inline-block text-[12.5px] font-medium"
                style={{ color: "var(--accent)" }}
              >
                Öppna portfölj ↗
              </a>
            )}

            {b.creator.pitch && (
              <p
                className="mb-3 rounded-lg border p-3 text-[12.5px] leading-relaxed"
                style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink-2)" }}
              >
                {b.creator.pitch}
              </p>
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

            {/* --- Godkänn brief --- */}
            {b.stage === "brief_review" && (
              <>
                {(b.brief || b.briefUrl) && (
                  <div
                    className="mb-3 rounded-lg border p-3 text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
                  >
                    {b.brief}
                    {b.briefUrl && (
                      <a
                        href={b.briefUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block font-medium"
                        style={{ color: "var(--accent)" }}
                      >
                        Öppna brief-dokumentet ↗
                      </a>
                    )}
                  </div>
                )}
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
              </>
            )}

            {/* --- Godkänn material --- */}
            {b.stage === "content_review" && (
              <>
                {b.contentLinks.length > 0 && (
                  <div className="mb-3 flex flex-col gap-1.5">
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
                    {b.contentNote && (
                      <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {b.contentNote}
                      </p>
                    )}
                  </div>
                )}
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
              </>
            )}

            {/* --- Väntar på svar från oss --- */}
            {b.approvalComment && b.stage !== "creators_review" && (
              <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                Er senaste kommentar: <i>{b.approvalComment}</i>
              </p>
            )}

            {/* --- Spårningslänk när produkten är på väg --- */}
            {(b.stage === "confirmed" || b.stage === "product_sent") && (
              <form action={clientSetTracking} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="bookingId" value={b.id} />
                <div className="min-w-[150px] flex-1">
                  <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
                    Spårningslänk (om ni skickar produkten)
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
            )}
          </Panel>
        ))
      )}

      <Disclaimer />
    </ExternalShell>
  );
}
