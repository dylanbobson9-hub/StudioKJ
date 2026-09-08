import { redirect } from "next/navigation";
import { getCurrentMember, can } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHead, Placeholder } from "@/components/ui";

export default async function EconomyPage() {
  const member = await getCurrentMember();
  const devMode = !db && process.env.NODE_ENV !== "production";
  if (!devMode && !can.econ(member)) redirect("/");

  return (
    <>
      <PageHead title="Ekonomi" sub="Kundpris, inköp, vinst och marginal. Bara Admin och Ekonomi." />
      <Placeholder note="Fas 2: P&L per kampanj och per kreatör, budgetflaggor, prisförslag till kund." />
    </>
  );
}
