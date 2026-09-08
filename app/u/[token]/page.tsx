import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";
import { LogoMark } from "@/components/Logo";
import { Card } from "@/components/ui";

export const metadata = { title: "Ditt uppdrag" };

export default async function CreatorView({ params }: PageProps<"/u/[token]"> ) {
  const { token } = await params;
  if (!db) notFound();

  const link = await db.query.accessToken.findFirst({
    where: and(
      eq(schema.accessToken.token, token),
      eq(schema.accessToken.kind, "creator"),
      eq(schema.accessToken.revoked, false),
    ),
  });
  if (!link?.bookingId) notFound();

  await db
    .update(schema.accessToken)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.accessToken.token, token));

  const bk = await db.query.booking.findFirst({ where: eq(schema.booking.id, link.bookingId) });
  if (!bk) notFound();
  const camp = await db.query.campaign.findFirst({ where: eq(schema.campaign.id, bk.campaignId) });

  return (
    <div className="mx-auto max-w-[680px] px-6 py-10" style={{ color: "var(--ink)" }}>
      <div className="mb-6 flex items-center gap-2.5">
        <LogoMark size={22} />
        <span className="text-[13px] font-semibold">KJ Studio</span>
      </div>
      <h1 className="text-[24px] font-bold tracking-[-0.025em]">Ditt uppdrag</h1>
      <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
        {camp?.name ?? "Kampanj"}
      </p>

      <div className="mt-6">
        <Card>
          <p className="text-[13px]" style={{ color: "var(--ink-2)" }}>
            Brief, produkt- &amp; trackinginfo, uppladdningslänk och status byggs i nästa steg.
          </p>
        </Card>
      </div>
    </div>
  );
}
