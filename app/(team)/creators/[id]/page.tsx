import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { Pill } from "@/components/pills";
import { getCurrentMember, can } from "@/lib/auth";
import { getCreator, listCampaigns, listBookings } from "@/lib/queries";
import { attachCreator } from "@/lib/actions";
import { stageLabel } from "@/lib/stages";

const field = { borderColor: "var(--line-2)", background: "var(--surface-2)" } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className="border-b py-2.5 last:border-b-0" style={{ borderColor: "var(--line)" }}>
      <div className="mb-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </div>
  );
}

export default async function CreatorPage({ params }: PageProps<"/creators/[id]">) {
  const me = await getCurrentMember();
  if (!can.operate(me)) redirect("/");

  const { id } = await params;
  const c = await getCreator(id);
  if (!c) notFound();

  const [campaigns, bookings] = await Promise.all([listCampaigns(), listBookings()]);
  const mine = bookings.filter((b) => b.creator.id === c.id);
  const busyOn = new Set(mine.map((b) => b.campaign.id));

  return (
    <>
      <Link href="/creators" className="mb-3 inline-block text-[12.5px]" style={{ color: "var(--accent)" }}>
        ← Katalogen
      </Link>

      <PageHead
        title={`${c.preferred ? "★ " : ""}${c.name}`}
        sub={[c.niche, [c.city, c.country].filter(Boolean).join(", "), c.platform].filter(Boolean).join(" · ")}
      />

      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div>
          <Card>
            {c.pitch && (
              <p
                className="mb-3 rounded-lg border p-3 text-[13px] leading-relaxed"
                style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--ink-2)" }}
              >
                {c.pitch}
              </p>
            )}
            <Row label="Kan filma">{c.canFilm}</Row>
            <Row label="Tackar nej till">{c.noGo}</Row>
            <Row label="Erfarenhet">{c.experience}</Row>
            <Row label="Språk">{c.languages}</Row>
            <Row label="Ålder / kön">
              {[c.age, c.gender === "f" ? "kvinna" : c.gender === "m" ? "man" : null].filter(Boolean).join(" · ")}
            </Row>
            <Row label="Riktpris">
              {c.priceNote}
              {c.priceEur && (
                <span style={{ color: "var(--muted)" }}> · ca {c.priceEur} € per video</span>
              )}
            </Row>
            <Row label="Storlek">{c.shirtSize}</Row>
          </Card>

          {mine.length > 0 && (
            <Card className="mt-4">
              <h2 className="mb-2 text-[13.5px] font-semibold">Uppdrag hos oss</h2>
              {mine.map((b) => (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-3 border-b py-2 last:border-b-0"
                  style={{ borderColor: "var(--line)" }}
                >
                  <span className="min-w-0 flex-1 truncate text-[13px]">
                    {b.campaign.name} <span style={{ color: "var(--muted)" }}>· {b.client.name}</span>
                  </span>
                  <Pill tone="neu">{stageLabel(b.stage)}</Pill>
                </Link>
              ))}
            </Card>
          )}
        </div>

        <div>
          <Card>
            <h2 className="mb-2 text-[13.5px] font-semibold">Koppla till kampanj</h2>
            {campaigns.length === 0 ? (
              <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                Lägg upp en kampanj först.
              </p>
            ) : (
              <form action={attachCreator} className="flex flex-col gap-2">
                <input type="hidden" name="creatorId" value={c.id} />
                <select name="campaignId" className="rounded-lg border px-3 py-2 text-[13px]" style={field}>
                  {campaigns.map((k) => (
                    <option key={k.id} value={k.id} disabled={busyOn.has(k.id)}>
                      {k.client.name} – {k.name}
                      {busyOn.has(k.id) ? " (redan kopplad)" : ""}
                    </option>
                  ))}
                </select>
                <button
                  className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  Koppla
                </button>
              </form>
            )}
          </Card>

          <Card className="mt-4">
            <h2 className="mb-2 text-[13.5px] font-semibold">Kontakt</h2>
            <Row label="Mejl">
              {c.email && (
                <a href={`mailto:${c.email}`} style={{ color: "var(--accent)" }}>
                  {c.email}
                </a>
              )}
            </Row>
            <Row label="Telefon">{c.phone}</Row>
            <Row label="Portfölj">
              {c.portfolioUrl && (
                <a
                  href={c.portfolioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all"
                  style={{ color: "var(--accent)" }}
                >
                  Öppna ↗
                </a>
              )}
            </Row>
            <Row label="Sociala">
              {c.socialUrl && (
                <span className="break-all" style={{ color: "var(--ink-2)" }}>
                  {c.socialUrl}
                </span>
              )}
            </Row>
            <Row label="Adress">{c.address}</Row>
            <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>
              Kontaktuppgifterna är interna. De syns aldrig i kundens vy.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
