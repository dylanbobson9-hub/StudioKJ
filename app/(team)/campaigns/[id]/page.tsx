import { PageHead, Placeholder } from "@/components/ui";

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  return (
    <>
      <PageHead
        title="Kampanj"
        sub={`Dashboard för kampanj ${id.slice(0, 8)}…`}
      />
      <Placeholder note="Fas-räknare, kreatörslista med steg + tidslinje, 'skapa kundlänk', prisförslag (Fas 2), disclaimer för kundvyn." />
    </>
  );
}
