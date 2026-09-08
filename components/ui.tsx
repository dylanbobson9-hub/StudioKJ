import type { ReactNode } from "react";

export function PageHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[27px] font-bold tracking-[-0.025em]">{title}</h1>
        {sub && (
          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)", maxWidth: "56ch" }}>
            {sub}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[13px] border p-5 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card className="text-center">
      <div className="py-10">
        <h3 className="text-[16px] font-semibold">{title}</h3>
        {hint && (
          <p className="mt-1.5 text-[13px]" style={{ color: "var(--muted)" }}>
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}

export function Placeholder({ note }: { note: string }) {
  return (
    <Card>
      <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
        {note}
      </p>
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        Byggs i nästa steg (se STATUS.md).
      </p>
    </Card>
  );
}
