import { Hero } from "@/components/Hero";
import { Method } from "@/components/Method";
import { RaceDayBar } from "@/components/RaceDayBar";
import { RaceList } from "@/components/RaceList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TodayLongshots } from "@/components/TodayLongshots";
import { races } from "@/data/races";

export default function Home() {
  return (
    <>
      <SiteHeader variant="overlay" showRaceDayBar={false} />
      <main>
        <Hero />
        <RaceDayBar />
        <TodayLongshots races={races} />
        <div className="section-rail" />
        <RaceList races={races} />
        <Method />
      </main>
      <SiteFooter />
    </>
  );
}
