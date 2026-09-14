"use client";

import { useState } from "react";

/** Kopierar adressen till urklipp så den inte behöver skrivas av för hand. */
export function CopyAddress({ text, className = "" }: { text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={{ borderColor: "var(--line-2)", background: "var(--surface)", color: "var(--ink-2)" }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* Blockerat urklipp – adressen går att markera för hand. */
        }
      }}
    >
      {done ? "Kopierad ✓" : "Kopiera adress"}
    </button>
  );
}
