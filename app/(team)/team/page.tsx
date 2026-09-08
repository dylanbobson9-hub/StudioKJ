import { PageHead, Placeholder } from "@/components/ui";

export default function TeamPage() {
  return (
    <>
      <PageHead title="Personer" sub="Alla som kan logga in i KJ Studio och vad de ser." />
      <Placeholder note="Lista team_member per roll (Admin / Ekonomi / KJ Crew / Redigerare). Lägg till / ändra roll. Bara admin." />
    </>
  );
}
