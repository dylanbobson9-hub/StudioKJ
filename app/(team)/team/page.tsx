import { redirect } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { Pill } from "@/components/pills";
import { getCurrentMember, can } from "@/lib/auth";
import { listTeam } from "@/lib/queries";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  ekonomi: "Ekonomi",
  crew: "KJ Crew",
  editor: "Redigerare",
};

export default async function TeamPage() {
  const me = await getCurrentMember();
  if (!can.managePeople(me)) redirect("/");
  const team = await listTeam();

  return (
    <>
      <PageHead title="Personer" sub="Alla som kan logga in i KJ Studio och vad de ser." />

      <Card className="mb-5">
        <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <b style={{ color: "var(--ink)" }}>Admin</b> – allt, inklusive ekonomi. <b style={{ color: "var(--ink)" }}>Ekonomi</b> – allt +
          all ekonomi. <b style={{ color: "var(--ink)" }}>KJ Crew</b> – driver flödet, ser inget ekonomiskt.{" "}
          <b style={{ color: "var(--ink)" }}>Redigerare</b> – bara sina egna redigeringsjobb.
        </p>
      </Card>

      <div
        className="overflow-hidden rounded-[13px] border"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        {team.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
            style={{ borderColor: "var(--line)" }}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{m.name}</div>
              <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                {m.email}
              </div>
            </div>
            <Pill tone={m.role === "admin" || m.role === "ekonomi" ? "accent" : "neu"}>
              {ROLE_LABEL[m.role] ?? m.role}
            </Pill>
          </div>
        ))}
      </div>

      <Card className="mt-5">
        <p className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          Lägg till personer med seed-skriptet tills vidare:{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>SEED_ADMIN_EMAIL=… npm run db:seed</code>. En riktig
          &quot;bjud in&quot;-knapp kommer.
        </p>
      </Card>
    </>
  );
}
