import { RaceList } from "@/components/RaceList";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function RacesPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand">
        <RaceList />
      </main>
      <SiteFooter />
    </>
  );
}
