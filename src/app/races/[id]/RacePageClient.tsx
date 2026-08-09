"use client";

import { RaceDetail } from "@/components/RaceDetail";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import type { TipsterRefPayload } from "@/components/TipsterRefPanel";
import type { Race } from "@/domain/types";

type Props = {
  race: Race;
  initialTipster: TipsterRefPayload | null;
};

export function RacePageClient({ race, initialTipster }: Props) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-4 py-12 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-4xl">
          <RaceDetail race={race} initialTipster={initialTipster} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
