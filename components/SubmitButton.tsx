"use client";

import { useFormStatus } from "react-dom";
import type { CSSProperties, ReactNode } from "react";

/**
 * Submit-knapp som låser sig medan formuläret skickas.
 *
 * Utan den hinner man trycka flera gånger innan sidan byts — och varje tryck
 * blev en ny rad. Det gav en kund tre identiska kampanjer.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  style,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      style={{ ...style, opacity: pending ? 0.6 : 1, cursor: pending ? "wait" : "pointer" }}
    >
      {pending ? (pendingLabel ?? "Sparar…") : children}
    </button>
  );
}
