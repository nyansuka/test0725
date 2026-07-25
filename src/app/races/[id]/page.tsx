"use client";

import { notFound } from "next/navigation";
import { use } from "react";
import { RaceDetail } from "@/components/RaceDetail";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { getRace } from "@/data/races";

type Props = {
  params: Promise<{ id: string }>;
};

export default function RacePage({ params }: Props) {
  const { id } = use(params);
  const { races } = useRaceCatalog();
  const race = races.find((r) => r.id === id) ?? getRace(id);
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
