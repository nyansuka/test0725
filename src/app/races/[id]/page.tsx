import { notFound } from "next/navigation";
import { RaceDetail } from "@/components/RaceDetail";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { races } from "@/data/races";

type Props = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return races.map((race) => ({ id: race.id }));
}

export default async function RacePage({ params }: Props) {
  const { id } = await params;
  const race = races.find((item) => item.id === id);
  if (!race) notFound();

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-6 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-4xl">
          <RaceDetail race={race} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
