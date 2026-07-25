import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
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

  const sorted = [...race.horses].sort((a, b) => b.confidence - a.confidence);

  return (
    <>
      <header className="border-b border-ink/10 bg-sand">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5 md:px-8">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.18em] text-turf"
          >
            UMANOTE
          </Link>
          <Link href="/#races" className="text-sm text-ink/70 transition hover:text-ink">
            ← レース一覧
          </Link>
        </div>
      </header>

      <main className="flex-1 bg-sand px-6 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-4xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            {race.venue} {race.raceNumber}R · {race.startTime}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink md:text-5xl">{race.title}</h1>
          <p className="mt-3 text-ink/70">
            {race.distance} · {race.weather} / {race.condition}
          </p>

          <div className="mt-12 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/20 text-ink/50">
                  <th className="py-3 pr-4 font-medium">馬番</th>
                  <th className="py-3 pr-4 font-medium">馬名</th>
                  <th className="py-3 pr-4 font-medium">騎手</th>
                  <th className="py-3 pr-4 font-medium">オッズ</th>
                  <th className="py-3 pr-4 font-medium">信頼度</th>
                  <th className="py-3 font-medium">コメント</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((horse) => (
                  <tr key={horse.number} className="border-b border-ink/10 align-top">
                    <td className="py-4 pr-4 font-[family-name:var(--font-display)] text-lg font-semibold">
                      {horse.number}
                    </td>
                    <td className="py-4 pr-4 font-medium text-ink">{horse.name}</td>
                    <td className="py-4 pr-4 text-ink/70">{horse.jockey}</td>
                    <td className="py-4 pr-4">{horse.odds.toFixed(1)}</td>
                    <td className="py-4 pr-4">
                      <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-turf">
                        {horse.confidence}
                      </span>
                    </td>
                    <td className="max-w-xs py-4 leading-relaxed text-ink/70">{horse.comment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
