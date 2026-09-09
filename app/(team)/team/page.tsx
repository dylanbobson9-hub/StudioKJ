import { redirect } from "next/navigation";
import { PageHead, Card } from "@/components/ui";
import { Pill } from "@/components/pills";
import { ConfirmSubmit, TrashIcon } from "@/components/ConfirmSubmit";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { getCurrentMember, can } from "@/lib/auth";
import { listTeam, listExports } from "@/lib/queries";
import { addTeamMember, setTeamRole, removeTeamMember } from "@/lib/actions";
import { TEAM_ROLES } from "@/lib/db/schema";

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  ekonomi: "Ekonomi",
  crew: "KJ Crew",
  editor: "Redigerare",
};

const field = {
  borderColor: "var(--line-2)",
  background: "var(--surface-2)",
} as const;

export default async function TeamPage() {
  const me = await getCurrentMember();
  if (!can.managePeople(me)) redirect("/");
  const [team, exports] = await Promise.all([listTeam(), listExports()]);

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
        {team.map((m) => {
          const isMe = m.id === me!.id;
          return (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-3 border-b px-4 py-3 last:border-b-0"
              style={{ borderColor: "var(--line)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold">
                  {m.name}
                  {isMe && (
                    <span className="ml-2 font-normal" style={{ color: "var(--muted)" }}>
                      du
                    </span>
                  )}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
                  {m.email}
                </div>
              </div>

              {isMe ? (
                <Pill tone="accent">{ROLE_LABEL[m.role] ?? m.role}</Pill>
              ) : (
                <>
                  <form action={setTeamRole} className="flex items-center gap-1">
                    <input type="hidden" name="memberId" value={m.id} />
                    <AutoSubmitSelect
                      name="role"
                      value={m.role}
                      className="rounded-lg border px-2.5 py-1.5 text-[12.5px]"
                      style={field}
                    >
                      {TEAM_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </AutoSubmitSelect>
                    <noscript>
                      <button className="text-[12px]" style={{ color: "var(--accent)" }}>
                        Spara
                      </button>
                    </noscript>
                  </form>
                  <form action={removeTeamMember}>
                    <input type="hidden" name="memberId" value={m.id} />
                    <ConfirmSubmit
                      message={`Ta bort ${m.name}? Personen kan inte längre logga in.`}
                      title="Ta bort"
                      className="rounded-lg border px-2 py-1.5"
                      style={{ borderColor: "var(--line-2)", color: "var(--muted)" }}
                    >
                      <TrashIcon />
                    </ConfirmSubmit>
                  </form>
                </>
              )}
            </div>
          );
        })}
      </div>

      <Card className="mt-5">
        <h2 className="mb-1 text-[13.5px] font-semibold">Bjud in någon</h2>
        <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          Personen får ett mejl och kan logga in direkt – inget lösenord behövs.
        </p>
        <form action={addTeamMember} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[130px] flex-1">
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Namn
            </label>
            <input
              name="name"
              required
              placeholder="Jacob Andersson"
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={field}
            />
          </div>
          <div className="min-w-[190px] flex-[2]">
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Jobbmejl
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="jacob@kjmarketingsweden.com"
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={field}
            />
          </div>
          <div>
            <label className="mb-1 block text-[11.5px]" style={{ color: "var(--ink-2)" }}>
              Roll
            </label>
            <select name="role" defaultValue="crew" className="rounded-lg border px-3 py-2 text-[13px]" style={field}>
              {TEAM_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="rounded-lg px-4 py-2 text-[13px] font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            Bjud in
          </button>
        </form>
      </Card>

      <Card className="mt-5">
        <h2 className="mb-1 text-[13.5px] font-semibold">Uttag av kreatörslistan</h2>
        <p className="mb-3 text-[12.5px]" style={{ color: "var(--ink-2)" }}>
          Katalogen är en affärshemlighet. En exporterad fil går inte att ta tillbaka, så här står vem som hämtat den.
        </p>
        {exports.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>
            Ingen har exporterat något ännu.
          </p>
        ) : (
          <div className="text-[12.5px]">
            {exports.map((e) => (
              <div
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-3 border-b py-2 last:border-b-0"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="font-medium">{e.memberEmail}</span>
                <span style={{ color: "var(--muted)" }}>
                  {new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(e.at)}
                </span>
                <span style={{ color: "var(--ink-2)" }}>{e.rows.toLocaleString("sv-SE")} kreatörer</span>
                {e.filter && (
                  <span className="truncate" style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                    {e.filter}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
