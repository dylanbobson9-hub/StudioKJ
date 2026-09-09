import { PageHead, EmptyState, Card } from "@/components/ui";
import { Pill } from "@/components/pills";
import { listActiveCreators } from "@/lib/queries";

export default async function CreatorsPage() {
  const creators = await listActiveCreators();

  return (
    <>
      <PageHead title="Kreatörer" sub="Kreatörer som ligger på minst ett uppdrag." />

      {creators.length === 0 ? (
        <EmptyState title="Inga kreatörer ännu" hint="Koppla en kreatör till en kampanj så dyker den upp här." />
      ) : (
        <div
          className="overflow-hidden rounded-[13px] border"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {creators.map(({ creator: c, active, total }) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {c.preferred && <span style={{ color: "#c99a1e" }} title="Guld – snabb, pålitlig, prisvärd (internt)">★ </span>}
                  {c.name}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                  {[c.handle, c.platform, c.country].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              {!c.verified && <Pill tone="warn">Bolag ej verifierat</Pill>}
              <Pill tone="neu">
                {active} aktiv{active === 1 ? "" : "a"} / {total}
              </Pill>
            </div>
          ))}
        </div>
      )}

      <Card className="mt-5">
        <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          Katalogen med de 1 387 kreatörerna – sök, filter, guldmarkering och AI-förslag – kommer i Fas 3. Just nu
          skapas kreatörer när du kopplar dem till en kampanj.
        </p>
      </Card>
    </>
  );
}
