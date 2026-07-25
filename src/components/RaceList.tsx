import Link from "next/link";
import type { Race } from "@/data/races";
import { getTopPicks } from "@/data/races";

type Props = {
  races: Race[];
};

export function RaceList({ races }: Props) {
  return (
    <section id="races" className="bg-sand-dim/50 px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
          RACE BOARD
        </p>
        <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">今日のレース予想</h2>
        <p className="mt-3 max-w-lg text-ink/70">
          各レースの上位候補を信頼度順に表示しています。詳細はレースページへ。
        </p>

        <div className="mt-12 space-y-0">
          {races.map((race) => {
            const top = getTopPicks(race, 1)[0];
            return (
              <Link
                key={race.id}
                href={`/races/${race.id}`}
                className="group grid border-t border-ink/15 py-6 transition hover:bg-sand/70 md:grid-cols-[140px_1fr_180px] md:items-center md:gap-6"
              >
                <div className="font-[family-name:var(--font-display)] text-sm tracking-wide text-ink/60">
                  {race.venue} {race.raceNumber}R
                  <span className="mt-1 block text-ink">{race.startTime}</span>
                </div>
                <div>
                  <p className="text-xl font-semibold text-ink group-hover:text-turf">{race.title}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    {race.distance} · {race.weather}/{race.condition}
                  </p>
                </div>
                <div className="mt-3 md:mt-0 md:text-right">
                  <p className="text-xs tracking-widest text-ink/45">本命</p>
                  <p className="mt-1 font-medium text-ink">
                    {top.number} {top.name}
                  </p>
                  <p className="text-sm text-turf">信頼度 {top.confidence}</p>
                </div>
              </Link>
            );
          })}
          <div className="border-t border-ink/15" />
        </div>
      </div>
    </section>
  );
}
