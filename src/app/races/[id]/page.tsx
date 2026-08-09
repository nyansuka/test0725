import { notFound } from "next/navigation";
import { RacePageClient } from "./RacePageClient";
import { loadRaceCatalog } from "@/data/loadCatalog";
import { loadTipsterRacePayload } from "@/data/loadTipsterRefs";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function RacePage({ params }: Props) {
  const { id } = await params;
  const [catalog, initialTipster] = await Promise.all([
    loadRaceCatalog(),
    loadTipsterRacePayload(id),
  ]);
  const race = catalog.races.find((r) => r.id === id);
  if (!race) notFound();

  return <RacePageClient race={race} initialTipster={initialTipster} />;
}
