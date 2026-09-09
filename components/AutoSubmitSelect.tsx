"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * Select som sparar direkt när man byter värde – ingen spara-knapp.
 * Faller tillbaka på knappen bredvid om JavaScript är avstängt.
 */
export function AutoSubmitSelect({
  name,
  value,
  children,
  className = "",
  style,
}: {
  name: string;
  value: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <select
      name={name}
      defaultValue={value}
      // key på värdet: annars visar select:en kvar det gamla valet efter en
      // server-rendering, eftersom React återanvänder DOM-noden.
      key={value}
      className={className}
      style={style}
      onChange={(e) => e.currentTarget.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}
