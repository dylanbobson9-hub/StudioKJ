import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";

const DISCLAIMER =
  "ALL RIGHTS RESERVED KJ MARKETING SWEDEN AB / Creators shown here may only be contacted through " +
  "KJ Marketing Sweden AB. Unauthorized direct contact or redistribution may lead to action in " +
  "accordance with our policy.";

/** Sidram för de inloggningsfria vyerna (/k och /u). */
export function ExternalShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-10" style={{ color: "var(--ink)" }}>
      <div className="mb-7 flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[13px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          KJ Studio
        </span>
      </div>
      <h1 className="text-[26px] font-bold tracking-[-0.025em]">{title}</h1>
      {sub && (
        <p className="mt-1 mb-7 text-[13px]" style={{ color: "var(--muted)" }}>
          {sub}
        </p>
      )}
      {children}
    </div>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-4 rounded-[13px] border p-5"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      {children}
    </div>
  );
}

export function Disclaimer() {
  return (
    <p
      className="mt-8 rounded-lg border p-3 text-[11px] leading-relaxed"
      style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--muted)" }}
    >
      {DISCLAIMER}
    </p>
  );
}

/**
 * Godkänn / avslå-par. Avslaget ligger bakom en utfällning så att den
 * vanligaste handlingen — att godkänna — är ett klick.
 */
export function Decision({
  token,
  bookingId,
  action,
  heading,
  approveLabel,
  rejectLabel,
  rejectPlaceholder,
  rejectRequired,
}: {
  token: string;
  bookingId: string;
  action: (fd: FormData) => Promise<void>;
  heading: string;
  approveLabel: string;
  rejectLabel: string;
  rejectPlaceholder: string;
  rejectRequired?: boolean;
}) {
  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "var(--line)" }}>
      <p className="mb-2.5 text-[13px] font-semibold">{heading}</p>
      <div className="flex flex-wrap items-start gap-2">
        <form action={action}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="decision" value="approve" />
          <button
            className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
            style={{ background: "var(--good)", color: "#fff" }}
          >
            {approveLabel}
          </button>
        </form>

        <details>
          <summary
            className="inline-flex cursor-pointer list-none rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
            style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
          >
            {rejectLabel}
          </summary>
          <form action={action} className="mt-2 flex flex-col gap-2">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="bookingId" value={bookingId} />
            <input type="hidden" name="decision" value="reject" />
            <textarea
              name="comment"
              rows={3}
              required={rejectRequired}
              placeholder={rejectPlaceholder}
              className="w-full rounded-lg border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)", minWidth: 280 }}
            />
            <div>
              <button
                className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
                style={{ background: "var(--crit)", color: "#fff" }}
              >
                Skicka
              </button>
            </div>
          </form>
        </details>
      </div>
    </div>
  );
}
