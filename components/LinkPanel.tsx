"use client";

import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border px-3 py-1.5 text-[12px]"
        style={{ borderColor: "var(--line-2)", background: "var(--sunk)", fontFamily: "var(--font-mono)" }}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          } catch {
            /* urklipp nekat – användaren får markera själv */
          }
        }}
        className="shrink-0 rounded-lg border px-3 py-1.5 text-[12px] font-semibold"
        style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
      >
        {done ? "Kopierad ✓" : "Kopiera"}
      </button>
    </div>
  );
}
