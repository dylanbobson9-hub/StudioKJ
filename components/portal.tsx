import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import { STAGE_META, progressPct, type Stage } from "@/lib/stages";
import { whoseTurn } from "@/lib/client-portal";

/**
 * Kundportalens ram. Samma flikar som teamet har — Översikt, Pipeline,
 * Kampanjen — för det var så prototypen fungerade och det kunden känner igen.
 * Badgen räknar det som ligger och väntar på dem.
 */
export function PortalShell({
  token,
  active,
  title,
  sub,
  waiting,
  children,
}: {
  token: string;
  active: "oversikt" | "pipeline" | "kampanj";
  title: string;
  sub?: string;
  waiting: number;
  children: ReactNode;
}) {
  const tabs = [
    { id: "oversikt", label: "Översikt", href: `/k/${token}` },
    { id: "pipeline", label: "Pipeline", href: `/k/${token}/pipeline` },
    { id: "kampanj", label: "Kampanjen", href: `/k/${token}/kampanj` },
  ] as const;

  return (
    <div className="mx-auto max-w-[880px] px-5 py-8" style={{ color: "var(--ink)" }}>
      <div className="mb-5 flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[13px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          KJ Studio
        </span>
      </div>

      <h1 className="text-[24px] font-bold tracking-[-0.025em]">{title}</h1>
      {sub && (
        <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}

      <nav className="mt-5 mb-6 flex gap-1 border-b" style={{ borderColor: "var(--line)" }}>
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href as Route}
              className="relative -mb-px flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium"
              style={{
                color: on ? "var(--accent)" : "var(--ink-2)",
                borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
              }}
            >
              {t.label}
              {t.id === "oversikt" && waiting > 0 && (
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold"
                  style={{ background: "var(--warn)", color: "#fff" }}
                >
                  {waiting}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {children}

      <p
        className="mt-8 rounded-lg border p-3 text-[11px] leading-relaxed"
        style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--muted)" }}
      >
        ALL RIGHTS RESERVED KJ MARKETING SWEDEN AB / Creators shown here may only be contacted through KJ Marketing
        Sweden AB. Unauthorized direct contact or redistribution may lead to action in accordance with our policy.
      </p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[13px] border p-4 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {children}
    </div>
  );
}

/** Stegetikett + vems tur, i kundens språk. */
export function StageLine({ stage }: { stage: Stage }) {
  const turn = whoseTurn(stage);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="rounded-full px-2 py-0.5 text-[11.5px] font-medium"
        style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
      >
        {STAGE_META[stage].label}
      </span>
      <span
        className="text-[11.5px] font-semibold"
        style={{ color: turn.you ? "var(--warn)" : "var(--muted)" }}
      >
        {turn.label}
      </span>
    </div>
  );
}

export function Bar({ stage }: { stage: Stage }) {
  const pct = progressPct(stage);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sunk)" }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
    </div>
  );
}

/** Kreatörskortets publika fakta – aldrig kontaktuppgifter eller pris. */
export function CreatorFacts({
  creator,
}: {
  creator: { platform: string | null; country: string | null; city: string | null; niche: string | null; languages: string | null; age: string | null; gender: string | null };
}) {
  const facts: [string, string | null][] = [
    ["Plattform", creator.platform],
    ["Plats", [creator.city, creator.country].filter(Boolean).join(", ") || null],
    ["Nisch", creator.niche],
    ["Språk", creator.languages],
    [
      "Ålder / kön",
      [creator.age, creator.gender === "f" ? "kvinna" : creator.gender === "m" ? "man" : null]
        .filter(Boolean)
        .join(" · ") || null,
    ],
  ];
  const shown = facts.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt className="text-[11px]" style={{ color: "var(--muted)" }}>
            {k}
          </dt>
          <dd className="text-[12.5px]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
