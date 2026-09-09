"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "./Logo";
import type { TeamRole } from "@/lib/db/schema";

type Item = { href: string; label: string; roles?: TeamRole[] };

const ITEMS: Item[] = [
  { href: "/", label: "Översikt" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/campaigns", label: "Kunder & kampanjer" },
  { href: "/economy", label: "Ekonomi", roles: ["admin", "ekonomi"] },
  { href: "/editing", label: "Redigering" },
  // Katalogen är affärshemlighet – redigerare ser bara sina egna jobb.
  { href: "/creators", label: "Kreatörer", roles: ["admin", "ekonomi", "crew"] },
  { href: "/team", label: "Personer", roles: ["admin"] },
];

export function Sidebar({
  member,
}: {
  member: { name: string; role: TeamRole } | null;
}) {
  const pathname = usePathname();
  const role = member?.role;
  const items = ITEMS.filter((i) => !i.roles || (role && i.roles.includes(role)));

  return (
    <aside
      className="flex flex-col gap-1 p-[18px_14px] sticky top-0 h-screen border-r"
      style={{ background: "var(--surface)", borderColor: "var(--line)", width: 224 }}
    >
      <div className="px-1.5 pb-4 pt-0.5">
        <Wordmark />
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((i) => {
          const active = i.href === "/" ? pathname === "/" : pathname.startsWith(i.href);
          return (
            <Link
              key={i.href}
              href={i.href as never}
              className="rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors"
              style={{
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--ink-2)",
              }}
            >
              {i.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <div className="text-[13px] font-semibold">{member?.name ?? "Inte inloggad"}</div>
        <div className="text-[11px] uppercase tracking-[0.1em]" style={{ color: "var(--muted)" }}>
          {member?.role ?? "—"}
        </div>
        <form action="/login/logout" method="post">
          <button
            className="mt-2 w-full rounded-md border px-2 py-1.5 text-[12px]"
            style={{ borderColor: "var(--line-2)", color: "var(--ink-2)" }}
          >
            Logga ut
          </button>
        </form>
      </div>
    </aside>
  );
}
