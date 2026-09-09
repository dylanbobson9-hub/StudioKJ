import { STAGES, SLA_HOURS, SLA_TARGET_DAYS, type Stage } from "@/lib/db/schema";

export { STAGES, SLA_TARGET_DAYS };
export type { Stage };

/** Vem bollen ligger hos i ett givet steg. */
export type Actor = "internal" | "client" | "creator" | null;

export const STAGE_META: Record<Stage, { label: string; actor: Actor }> = {
  sourcing: { label: "Kandidat", actor: "internal" },
  creators_review: { label: "Föreslagen till kund", actor: "client" },
  price_talk: { label: "Offert & förfrågan", actor: "internal" },
  confirmed: { label: "Bekräftad", actor: "internal" },
  product_sent: { label: "Produkt skickad", actor: "creator" },
  product_received: { label: "Produkt mottagen", actor: "internal" },
  script: { label: "Manus", actor: "internal" },
  brief_review: { label: "Brief inväntar godkännande", actor: "client" },
  brief_approved: { label: "Brief godkänd", actor: "creator" },
  filming: { label: "Inspelning pågår", actor: "creator" },
  editing: { label: "Redigering", actor: "internal" },
  content_review: { label: "Material inväntar godkännande", actor: "client" },
  content_approved: { label: "Material godkänt", actor: "internal" },
  scheduled: { label: "Inplanerad publicering", actor: "creator" },
  published: { label: "Publicerat", actor: null },
  done: { label: "Klar", actor: null },
};

export const PHASES = [
  { id: "start", label: "Uppstart", stages: ["sourcing", "creators_review", "price_talk", "confirmed"] },
  { id: "prep", label: "Förbereder", stages: ["product_sent", "product_received", "script", "brief_review", "brief_approved"] },
  { id: "prod", label: "Produktion", stages: ["filming", "editing"] },
  { id: "review", label: "Godkännande", stages: ["content_review", "content_approved"] },
  { id: "done", label: "Klart", stages: ["scheduled", "published", "done"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; stages: readonly Stage[] }>;

export type PhaseId = (typeof PHASES)[number]["id"];

const PHASE_BY_STAGE = Object.fromEntries(
  PHASES.flatMap((p) => p.stages.map((s) => [s, p.id])),
) as Record<Stage, PhaseId>;

export const phaseOf = (s: Stage): PhaseId => PHASE_BY_STAGE[s] ?? "start";
export const stageIndex = (s: Stage): number => STAGES.indexOf(s);
export const stageLabel = (s: Stage): string => STAGE_META[s]?.label ?? s;
export const progressPct = (s: Stage): number =>
  Math.round((stageIndex(s) / (STAGES.length - 1)) * 100);

/* ------------------------------------------------------------------ */
/*  Tidsplan                                                            */
/* ------------------------------------------------------------------ */

export type SlaLevel = "ok" | "late" | "swap";
export type SlaState = {
  level: SlaLevel;
  what: string;
  hours: number;
  /** Timmar över första deadline. */
  over: number;
  /** Timmar kvar till första deadline. */
  left: number;
  /** Timmar kvar till utbytesdeadline, om steget har en. */
  escLeft: number | null;
  /** Steget har en utbytesregel (bara outreach). */
  canSwap: boolean;
  reminded: boolean;
};

type SlaInput = {
  stage: Stage;
  stageSince: Date | string;
  holdActive?: boolean | null;
  reminderSentAt?: Date | string | null;
};

/** Var uppdraget står mot tidsplanen. `null` = ingen klocka (pausat eller slutsteg). */
export function slaFor(b: SlaInput, now: number = Date.now()): SlaState | null {
  if (b.holdActive) return null;
  const cfg = SLA_HOURS[b.stage];
  if (!cfg) return null;
  const since = new Date(b.stageSince).getTime();
  if (!Number.isFinite(since)) return null;

  const hours = (now - since) / 3_600_000;
  const esc = cfg.escalate ?? null;
  const level: SlaLevel = esc && hours >= esc ? "swap" : hours >= cfg.h ? "late" : "ok";

  return {
    level,
    what: cfg.what,
    hours,
    over: Math.max(0, hours - cfg.h),
    left: Math.max(0, cfg.h - hours),
    escLeft: esc ? Math.max(0, esc - hours) : null,
    canSwap: esc != null,
    reminded: !!b.reminderSentAt,
  };
}

/** Sorteringsvikt – störst först i "brinner"-listan. -1 = inom tidsplanen. */
export function slaRank(b: SlaInput, now?: number): number {
  const s = slaFor(b, now);
  if (!s || s.level === "ok") return -1;
  return (s.level === "swap" ? 1e6 : 0) + s.over;
}

/** Timmar → "6 h" / "1 d 4 h" / "3 d". */
export function fmtDur(h: number): string {
  const t = Math.max(0, Math.round(h));
  if (t < 24) return `${t} h`;
  const d = Math.floor(t / 24);
  const r = t % 24;
  return r ? `${d} d ${r} h` : `${d} d`;
}

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short" }).format(new Date(d));
}

export function ago(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000);
  if (days <= 0) return "idag";
  if (days === 1) return "igår";
  if (days < 7) return `${days} dgr`;
  if (days < 30) return `${Math.floor(days / 7)} v`;
  return `${Math.floor(days / 30)} mån`;
}
