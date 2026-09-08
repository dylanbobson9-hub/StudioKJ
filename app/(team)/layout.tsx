import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/Sidebar";
import type { TeamRole } from "@/lib/db/schema";

export default async function TeamLayout({ children }: LayoutProps<"/">) {
  const member = await getCurrentMember();

  // Dev without a database yet: show the shell with a placeholder identity so
  // the UI is browsable. Never happens in production (db is required there).
  const devMode = !db && process.env.NODE_ENV !== "production";
  if (!member && !devMode) redirect("/login");

  const shellMember: { name: string; role: TeamRole } | null = member
    ? { name: member.name, role: member.role }
    : devMode
      ? { name: "Utvecklingsläge", role: "admin" }
      : null;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--paper)" }}>
      <Sidebar member={shellMember} />
      <main className="min-w-0 flex-1 px-8 py-7 pb-24" style={{ maxWidth: 1180 }}>
        {devMode && (
          <div
            className="mb-5 rounded-lg border px-4 py-2.5 text-[12.5px]"
            style={{ borderColor: "var(--warn)", background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            Utvecklingsläge – ingen databas konfigurerad. Sätt <code>DATABASE_URL</code> i{" "}
            <code>.env.local</code> för riktig data och inloggning.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
