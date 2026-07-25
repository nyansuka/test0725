import { RaceList } from "@/components/RaceList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { races } from "@/data/races";

export default function RacesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand">
        <RaceList races={races} />
      </main>
      <SiteFooter />
    </>
  );
}
