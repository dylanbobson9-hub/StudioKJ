import type { ReactNode } from "react";
import { STAGE_META, fmtDur, slaFor, type Stage, type SlaState } from "@/lib/stages";

type Tone = "neu" | "accent" | "good" | "warn" | "crit" | "info";

const TONE: Record<Tone, { bg: string; fg: string }> = {
  neu: { bg: "var(--surface-2)", fg: "var(--ink-2)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  good: { bg: "var(--good-soft)", fg: "var(--good)" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  crit: { bg: "var(--crit-soft)", fg: "var(--crit)" },
  info: { bg: "var(--accent-soft)", fg: "var(--accent-2)" },
};

export function Pill({ tone = "neu", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export function StagePill({ stage }: { stage: Stage }) {
  const meta = STAGE_META[stage];
  const tone: Tone =
    meta.actor === "client" ? "warn" : meta.actor === "creator" ? "info" : meta.actor === "internal" ? "accent" : "good";
  return <Pill tone={tone}>{meta.label}</Pill>;
}

type SlaInput = Parameters<typeof slaFor>[0];

export function SlaPill({ booking }: { booking: SlaInput }) {
  const s: SlaState | null = slaFor(booking);
  if (!s) return null;
  if (s.level === "swap")
    return (
      <Pill tone="crit" title={s.what}>
        {fmtDur(s.hours)} utan svar – byt kreatör
      </Pill>
    );
  if (s.level === "late")
    return (
      <Pill tone="warn" title={s.what}>
        {fmtDur(s.over)} över deadline
      </Pill>
    );
  if (s.left <= 8)
    return (
      <Pill tone="neu" title={s.what}>
        {fmtDur(s.left)} kvar
      </Pill>
    );
  return null;
}

export function HoldPill({ reason, note }: { reason?: string | null; note?: string | null }) {
  return reason === "swapped" ? (
    <Pill tone="crit" title={note ?? undefined}>
      Utbytt
    </Pill>
  ) : (
    <Pill tone="neu" title={note ?? undefined}>
      Pausad
    </Pill>
  );
}

export function Progress({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-[110px] shrink-0 overflow-hidden rounded-full" style={{ background: "var(--sunk)" }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: "linear-gradient(90deg,var(--accent),var(--accent-2))" }}
      />
    </div>
  );
}
