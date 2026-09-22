import { SubmitButton } from "@/components/SubmitButton";
import { clientDecideContent } from "@/lib/token-actions";

/**
 * Kundens granskning av materialet. Två val, lika synliga: godkänn eller
 * begär revidering. Revideringen kräver text och en bekräftelse på att det
 * är allt – varje extra runda kostar en redigering och flera dagar, så målet
 * är att alla ändringar kommer i samma svep.
 */
export function ContentReview({
  token,
  bookingId,
  links,
  note,
  stage,
  approval,
  lastComment,
}: {
  token: string;
  bookingId: string;
  links: string[];
  note: string | null;
  stage: string;
  approval: string;
  lastComment: string | null;
}) {
  const reviewing = stage === "content_review";

  // Revidering skickad – vi jobbar på nästa version.
  if (!reviewing && approval === "changes") {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
        <div className="text-[14px] font-semibold">Er revidering är skickad</div>
        <p className="mt-1 text-[13px]" style={{ color: "var(--ink-2)" }}>
          Vi gör ändringarna och lägger upp en ny version här. Ni får ett mejl när den är klar.
        </p>
        {lastComment && (
          <div className="mt-3 border-t pt-3 text-[12.5px] whitespace-pre-wrap" style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}>
            <span style={{ color: "var(--muted)" }}>Ni skrev: </span>
            {lastComment}
          </div>
        )}
      </div>
    );
  }

  if (approval === "approved") {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--good)", background: "var(--good-soft)" }}>
        <div className="text-[14px] font-semibold" style={{ color: "var(--good)" }}>
          ✓ Ni har godkänt materialet
        </div>
        <LinkList links={links} />
      </div>
    );
  }

  if (!reviewing) return null;

  return (
    <div>
      {note && (
        <p className="mb-3 rounded-lg border p-3 text-[13px]" style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}>
          {note}
        </p>
      )}

      <LinkList links={links} big />

      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--line)" }}>
        <p className="mb-3 text-[13.5px] font-semibold">Vad tycker ni?</p>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* Godkänn – ett klick */}
          <form action={clientDecideContent} className="sm:w-[190px] sm:shrink-0">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="decision" value="approve" />
            <SubmitButton
              pendingLabel="Godkänner…"
              className="w-full rounded-lg px-4 py-3 text-[14px] font-semibold"
              style={{ background: "var(--good)", color: "#fff" }}
            >
              ✓ Godkänn
            </SubmitButton>
          </form>

          {/* Revidering – fälls ut */}
          <details className="group min-w-0 flex-1">
            <summary
              className="flex w-full cursor-pointer list-none items-center justify-center rounded-lg border px-4 py-3 text-[14px] font-semibold group-open:rounded-b-none"
              style={{ borderColor: "var(--warn)", color: "var(--warn)", background: "var(--surface)" }}
            >
              Begär revidering
            </summary>
            <form
              action={clientDecideContent}
              className="flex flex-col gap-2.5 rounded-b-lg border border-t-0 p-3"
              style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}
            >
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="decision" value="reject" />

              <p className="text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
                <b>Skriv ALLT ni vill ändra – på en gång.</b> Vi gör alla ändringar i samma runda, så det som inte
                står här kommer inte med i nästa version.
              </p>

              <textarea
                name="comment"
                required
                rows={8}
                placeholder={
                  "En ändring per rad, gärna med tidpunkt:\n\n" +
                  "• 0:03 – byt hooken till något mer direkt\n" +
                  "• 0:12 – produkten syns för kort\n" +
                  "• Texten i slutet: ”Köp nu” i stället för ”Läs mer”\n" +
                  "• Musiken är för hög"
                }
                className="w-full rounded-lg border px-3 py-2.5 text-[13.5px] leading-relaxed"
                style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
              />

              <label className="flex items-start gap-2 text-[12.5px]" style={{ color: "var(--ink)" }}>
                <input type="checkbox" name="allChanges" value="1" required className="mt-0.5" />
                Det här är alla ändringar vi vill ha.
              </label>

              <div>
                <SubmitButton
                  pendingLabel="Skickar…"
                  className="rounded-lg px-4 py-2.5 text-[13.5px] font-semibold"
                  style={{ background: "var(--warn)", color: "#fff" }}
                >
                  Skicka revidering
                </SubmitButton>
              </div>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}

function LinkList({ links, big }: { links: string[]; big?: boolean }) {
  if (!links.length) return null;
  return (
    <div className={`flex flex-col gap-2 ${big ? "" : "mt-2"}`}>
      {links.map((l, i) => (
        <a
          key={l}
          href={l}
          target="_blank"
          rel="noopener noreferrer"
          className={
            big
              ? "flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-[14px] font-semibold"
              : "text-[12.5px] break-all"
          }
          style={big ? { borderColor: "var(--accent)", color: "var(--accent)", background: "var(--accent-soft)" } : { color: "var(--accent)" }}
        >
          {big ? (
            <>
              <span>▶ Titta på {links.length > 1 ? `video ${i + 1}` : "materialet"}</span>
              <span className="text-[12px] font-medium">Öppnas i Drive ↗</span>
            </>
          ) : (
            l
          )}
        </a>
      ))}
    </div>
  );
}
