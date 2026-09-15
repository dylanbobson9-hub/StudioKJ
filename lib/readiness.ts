import type { Creator } from "@/lib/db/schema";

/**
 * Vad som saknas för att ett uppdrag ska kunna gå hela vägen.
 *
 * Katalogen är full av luckor – nästan ingen har adress eller bankuppgifter –
 * och det är helt normalt för någon som bara sökt jobb. Därför visas det här
 * först när kreatören kopplas till en kampanj, inte i katalogen, där det
 * bara hade varit brus på varje rad.
 */

export type Missing = { key: string; label: string; group: "frakt" | "kontakt" | "utbetalning" };

export function missingFor(
  c: Pick<
    Creator,
    "address" | "city" | "email" | "phone" | "payoutType" | "bankAccount" | "regNumber" | "companyName" | "personalNumberEnc"
  >,
): Missing[] {
  const out: Missing[] = [];

  if (!c.address) out.push({ key: "address", label: "adress", group: "frakt" });
  if (!c.city) out.push({ key: "city", label: "stad", group: "frakt" });

  if (!c.email) out.push({ key: "email", label: "mejl", group: "kontakt" });
  if (!c.phone) out.push({ key: "phone", label: "telefon", group: "kontakt" });

  if (!c.payoutType) {
    out.push({ key: "payoutType", label: "bolag eller privatperson", group: "utbetalning" });
  } else if (c.payoutType === "company") {
    if (!c.companyName) out.push({ key: "companyName", label: "bolagsnamn", group: "utbetalning" });
    if (!c.regNumber) out.push({ key: "regNumber", label: "orgnr", group: "utbetalning" });
  } else if (!c.personalNumberEnc) {
    out.push({ key: "personalNumber", label: "personnummer", group: "utbetalning" });
  }
  if (!c.bankAccount) out.push({ key: "bankAccount", label: "bankkonto", group: "utbetalning" });

  return out;
}

/** "adress, stad, personnummer" – kort nog för en rad i en lista. */
export function missingLabel(m: Missing[], max = 3): string {
  const labels = m.map((x) => x.label);
  return labels.length <= max ? labels.join(", ") : `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}
