import { PageHead, Placeholder } from "@/components/ui";

export default function CampaignsPage() {
  return (
    <>
      <PageHead
        title="Kunder & kampanjer"
        sub="Kampanjer grupperade per kund."
        action={
          <button
            className="rounded-lg px-3.5 py-2 text-[13px] font-semibold"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            + Ny kund
          </button>
        }
      />
      <Placeholder note="Lista per kund → kampanjer med framsteg, ref-nr, marknad. Klick öppnar kampanj-dashboarden." />
    </>
  );
}
