import { FeaturedRace } from "@/components/FeaturedRace";
import { Hero } from "@/components/Hero";
import { Method } from "@/components/Method";
import { RaceList } from "@/components/RaceList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getFeaturedRace, races } from "@/data/races";

export default function Home() {
  const featured = getFeaturedRace();

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FeaturedRace race={featured} />
        <div className="section-rail" />
        <RaceList races={races} />
        <Method />
      </main>
      <SiteFooter />
    </>
  );
}
