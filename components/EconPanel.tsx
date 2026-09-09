import { Card } from "@/components/ui";
import { saveCampaignEcon, saveBookingEcon } from "@/lib/actions";
import { campaignPL, kr, pct } from "@/lib/econ";

const field = { borderColor: "var(--line-2)", background: "var(--surface-2)" } as const;

function Money({
  label,
  name,
  value,
  hint,
}: {
  label: string;
  name: string;
  value: number | null;
  hint?: string;
}) {
  return (
    <div className="min-w-[110px] flex-1">
      <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
        {label}
      </label>
      <input
        name={name}
        inputMode="numeric"
        // Tomt fält betyder "inte satt" – därför inte defaultValue={0}.
        defaultValue={value ?? ""}
        placeholder="0"
        className="w-full rounded-lg border px-3 py-2 text-[13px]"
        style={field}
      />
      {hint && (
        <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * Ekonomin för en kampanj. Renderas bara för Admin och Ekonomi – anroparen
 * ansvarar för behörighetskollen, server actions kollar den igen.
 */
export async function EconPanel({ campaignId }: { campaignId: string }) {
  const pl = await campaignPL(campaignId);

  return (
    <Card className="mt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold">Ekonomi</h2>
        <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
          Alla belopp exklusive moms · syns bara för Admin och Ekonomi
        </span>
      </div>

      {/* --- Kampanjens egna poster --- */}
      <form action={saveCampaignEcon} className="mb-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <Money label="Vårt arvode" name="agencyFee" value={pl.agencyFee || null} hint="läggs på kundens total" />
        <Money label="Redigering" name="editingCost" value={pl.editingCost || null} hint="vår kostnad" />
        <button
          className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          Spara
        </button>
      </form>

      {/* --- Rad per uppdrag --- */}
      {pl.lines.length > 0 && (
        <div className="mb-4">
          {pl.lines.map((l) => (
            <form
              key={l.bookingId}
              action={saveBookingEcon}
              className="flex flex-wrap items-end gap-2 border-t py-2.5"
              style={{ borderColor: "var(--line)" }}
            >
              <input type="hidden" name="bookingId" value={l.bookingId} />
              <div className="min-w-[120px] flex-1 pb-2 text-[13px] font-medium">{l.creatorName}</div>
              <Money label="Kundpris" name="clientPrice" value={l.clientPrice || null} />
              <Money label="Kreatören får" name="creatorFee" value={l.creatorFee || null} />
              <Money label="Utlägg" name="extraCost" value={l.extraCost || null} hint="produkt, frakt" />
              <button
                className="rounded-lg border px-3 py-2 text-[13px] font-semibold"
                style={{ borderColor: "var(--line-2)" }}
              >
                Spara
              </button>
            </form>
          ))}
        </div>
      )}

      {/* --- Summan --- */}
      <div
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--line)", background: "var(--surface-2)" }}
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Kunden faktureras", kr(pl.invoiced), undefined],
            ["Vår kostnad", kr(pl.cost), undefined],
            ["Vinst", kr(pl.profit), pl.profit < 0 ? "var(--crit)" : "var(--good)"],
            ["Marginal", pct(pl.margin), undefined],
          ].map(([label, value, tone]) => (
            <div key={label}>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                {label}
              </div>
              <div className="text-[15px] font-semibold" style={{ color: tone ?? "var(--ink)" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-[11.5px]" style={{ color: "var(--ink-2)" }}>
          Kundens total = uppdragens kundpris + vårt arvode ({kr(pl.agencyFee)}). Det är samma uträkning som kundens
          portal visar.
          {pl.unpriced > 0 && (
            <span style={{ color: "var(--warn)" }}> {pl.unpriced} uppdrag saknar pris och räknas som noll.</span>
          )}
        </p>
      </div>
    </Card>
  );
}
