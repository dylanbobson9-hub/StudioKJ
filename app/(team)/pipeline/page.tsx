import { PageHead, Placeholder } from "@/components/ui";

export default function PipelinePage() {
  return (
    <>
      <PageHead title="Pipeline" sub="Fem faser, alla kampanjer." />
      <Placeholder note="Board med 5 faser (Uppstart → Förbereder → Produktion → Godkännande → Klart). Varje kort = ett uppdrag med exakt steg som pill." />
    </>
  );
}
