import { PageHead, Placeholder } from "@/components/ui";

export default function OverviewPage() {
  return (
    <>
      <PageHead
        title="Översikt"
        sub="Hela produktionsflödet – vad som rör sig och vad som står stilla."
      />
      <Placeholder note="Här kommer KPI-rutor (aktiva uppdrag, hos kund, hos kreatör, publicerat), 'kräver en intern insats'-listan och senaste händelser – hämtat från bookings." />
    </>
  );
}
