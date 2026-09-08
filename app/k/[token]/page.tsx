import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { LogoMark } from "@/components/Logo";
import { Card } from "@/components/ui";

export const metadata = { title: "Kampanj" };

const DISCLAIMER =
  "ALL RIGHTS RESERVED KJ MARKETING SWEDEN AB / Creators shown here may only be contacted through KJ Marketing Sweden AB. Unauthorized direct contact or redistribution may lead to action in accordance with our policy.";

export default async function ClientView({ params }: PageProps<"/k/[token]"> ) {
  const { token } = await params;
  if (!db) notFound();

  const link = await db.query.accessToken.findFirst({
    where: and(
      eq(schema.accessToken.token, token),
      eq(schema.accessToken.kind, "client"),
      eq(schema.accessToken.revoked, false),
    ),
  });
  if (!link?.campaignId) notFound();

  await db
    .update(schema.accessToken)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.accessToken.token, token));

  const camp = await db.query.campaign.findFirst({
    where: eq(schema.campaign.id, link.campaignId),
  });
  if (!camp) notFound();

  return (
    <div className="mx-auto max-w-[760px] px-6 py-10" style={{ color: "var(--ink)" }}>
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[13px] font-semibold">KJ Studio</span>
      </div>
      <h1 className="text-[26px] font-bold tracking-[-0.025em]">{camp.name}</h1>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
        Följ kampanjen live. Godkänn brief och material när det är din tur.
      </p>

      <div className="mt-6">
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Kreatörslistan med steg, godkänn-knappar och prisförslag byggs i nästa steg.
          </p>
        </Card>
      </div>

      <p
        className="mt-8 rounded-lg border p-3 text-[11px] leading-relaxed"
        style={{ borderColor: "var(--line)", background: "var(--surface-2)", color: "var(--muted)" }}
      >
        {DISCLAIMER}
      </p>
    </div>
  );
}
