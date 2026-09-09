import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { PageHead, EmptyState } from "@/components/ui";
import { Pill } from "@/components/pills";
import { getCurrentMember, can } from "@/lib/auth";
import { attachCreator } from "@/lib/actions";
import { searchCreators, creatorFacets, getCampaign, type CreatorFilter } from "@/lib/queries";

const PER_PAGE = 60;

const PLATFORMS = ["TikTok", "Instagram", "YouTube"];
const SORTS = [
  { v: "gold", label: "Guld först" },
  { v: "name", label: "Namn" },
  { v: "price", label: "Lägsta pris" },
];

const field = { borderColor: "var(--line-2)", background: "var(--surface-2)" } as const;

/** Läser filtren ur adressfältet så en sökning går att spara och dela. */
function parse(sp: Record<string, string | string[] | undefined>): CreatorFilter & { page: number } {
  const s = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
  };
  const page = Math.max(1, Number(s("sida") ?? 1) || 1);
  return {
    q: s("q"),
    country: s("land"),
    platform: s("plattform"),
    gender: s("kon"),
    gold: s("guld") === "1",
    withEmail: s("mejl") === "1",
    maxPrice: Number(s("maxpris")) || undefined,
    sort: (s("sort") as CreatorFilter["sort"]) ?? "gold",
    page,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  };
}

/** Behåller övriga filter när man byter ett av dem. */
function href(sp: Record<string, string | string[] | undefined>, patch: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) p.set(k, val);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v) p.set(k, v);
    else p.delete(k);
  }
  if (!patch.sida) p.delete("sida");
  const s = p.toString();
  // Query-strängen byggs vid körning, så typade routes kan inte kontrollera den.
  return (s ? `/creators?${s}` : "/creators") as Route;
}

/** Samma filter, men hela träfflistan – inte bara sidan man tittar på. */
function exportHref(sp: Record<string, string | string[] | undefined>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val && k !== "sida") p.set(k, val);
  }
  const s = p.toString();
  return s ? `/creators/export?${s}` : "/creators/export";
}

export default async function CreatorsPage({ searchParams }: PageProps<"/creators">) {
  const me = await getCurrentMember();
  if (!can.operate(me)) redirect("/");

  const sp = await searchParams;
  const f = parse(sp);
  // ?kampanj=<id> slår om listan till kopplingsläge: en knapp per rad.
  const campaignId = (Array.isArray(sp.kampanj) ? sp.kampanj[0] : sp.kampanj)?.trim();
  const campaign = campaignId ? await getCampaign(campaignId) : null;

  const [{ rows, total }, { countries }] = await Promise.all([searchCreators(f), creatorFacets()]);

  const pages = Math.ceil(total / PER_PAGE);
  const active = [f.q, f.country, f.platform, f.gender, f.gold ? "guld" : null, f.withEmail ? "mejl" : null].filter(
    Boolean,
  ).length;

  return (
    <>
      <PageHead
        title={campaign ? `Koppla kreatör till ${campaign.name}` : "Kreatörer"}
        sub={
          campaign
            ? `${campaign.client.name} · sök fram rätt person och koppla direkt.`
            : `${total.toLocaleString("sv-SE")} i katalogen${active ? " som matchar filtret" : ""} – sök, filtrera och exportera.`
        }
      />

      {campaign && (
        <Link
          href={`/campaigns/${campaign.id}`}
          className="mb-3 inline-block text-[12.5px]"
          style={{ color: "var(--accent)" }}
        >
          ← Tillbaka till kampanjen
        </Link>
      )}

      {/* --- Sök och filter, allt i adressfältet så en sökning går att dela --- */}
      <form
        className="mb-4 rounded-[13px] border p-3"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        {campaign && <input type="hidden" name="kampanj" value={campaign.id} />}
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-[3]">
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Sök
            </label>
            <input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="nisch, stad, språk, vad de kan filma…"
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={field}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Land
            </label>
            <select name="land" defaultValue={f.country ?? ""} className="rounded-lg border px-3 py-2 text-[13px]" style={field}>
              <option value="">Alla</option>
              {countries.map((c) => (
                <option key={c.value} value={c.value!}>
                  {c.value} ({c.n})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Plattform
            </label>
            <select
              name="plattform"
              defaultValue={f.platform ?? ""}
              className="rounded-lg border px-3 py-2 text-[13px]"
              style={field}
            >
              <option value="">Alla</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Kön
            </label>
            <select name="kon" defaultValue={f.gender ?? ""} className="rounded-lg border px-3 py-2 text-[13px]" style={field}>
              <option value="">Alla</option>
              <option value="f">Kvinna</option>
              <option value="m">Man</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Max €/video
            </label>
            <input
              name="maxpris"
              type="number"
              min="0"
              defaultValue={f.maxPrice ?? ""}
              placeholder="200"
              className="w-[92px] rounded-lg border px-3 py-2 text-[13px]"
              style={field}
            />
          </div>

          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Sortering
            </label>
            <select name="sort" defaultValue={f.sort} className="rounded-lg border px-3 py-2 text-[13px]" style={field}>
              {SORTS.map((s) => (
                <option key={s.v} value={s.v}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Sök
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[12.5px]">
          <label className="flex items-center gap-1.5" style={{ color: "var(--ink-2)" }}>
            <input type="checkbox" name="guld" value="1" defaultChecked={f.gold} />
            Bara guld
          </label>
          <label className="flex items-center gap-1.5" style={{ color: "var(--ink-2)" }}>
            <input type="checkbox" name="mejl" value="1" defaultChecked={f.withEmail} />
            Har mejladress
          </label>
          {active > 0 && (
            <Link href="/creators" style={{ color: "var(--accent)" }}>
              Rensa filter
            </Link>
          )}
          <a href={exportHref(sp)} className="ml-auto font-medium" style={{ color: "var(--accent)" }}>
            Exportera {total.toLocaleString("sv-SE")} som CSV ↓
          </a>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Ingen matchar" hint="Prova ett bredare sökord eller rensa filtren." />
      ) : (
        <div
          className="overflow-hidden rounded-[13px] border"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          {rows.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <Link href={`/creators/${c.id}`} className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {c.preferred && (
                    <span style={{ color: "#c99a1e" }} title="Guld – snabb, pålitlig, prisvärd (internt)">
                      ★{" "}
                    </span>
                  )}
                  {c.name}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                  {[c.niche, [c.city, c.country].filter(Boolean).join(", "), c.platform].filter(Boolean).join(" · ") ||
                    "—"}
                </div>
              </Link>

              {c.priceEur && (
                <span className="shrink-0 text-[12.5px]" style={{ color: "var(--ink-2)" }} title={c.priceNote ?? ""}>
                  ~{c.priceEur} €
                </span>
              )}
              {!campaign && c.email && <Pill tone="neu">mejl</Pill>}

              {campaign && (
                <form action={attachCreator}>
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <input type="hidden" name="creatorId" value={c.id} />
                  <button
                    className="shrink-0 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white"
                    style={{ background: "var(--accent)" }}
                  >
                    Koppla
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-[12.5px]">
          <span style={{ color: "var(--muted)" }}>
            Sida {f.page} av {pages}
          </span>
          <div className="flex gap-2">
            {f.page > 1 && (
              <Link href={href(sp, { sida: String(f.page - 1) })} style={{ color: "var(--accent)" }}>
                ← Föregående
              </Link>
            )}
            {f.page < pages && (
              <Link href={href(sp, { sida: String(f.page + 1) })} style={{ color: "var(--accent)" }}>
                Nästa →
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
