import { notFound } from "next/navigation";
import { RacePageClient } from "./RacePageClient";
import { loadRaceCatalog } from "@/data/loadCatalog";
import { loadTipsterRacePayload } from "@/data/loadTipsterRefs";

type Props = {
  params: Promise<{ id: string }>;
};

/** レース詳細もビルド時静的化（リクエストごとのフルカタログ SSR を避ける） */
export const dynamic = "force-static";

export async function generateStaticParams() {
  const catalog = await loadRaceCatalog();
  return catalog.races.map((race) => ({ id: race.id }));
}

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
