"use client";

import Link from "next/link";
import { useMemo } from "react";
import { raceExpectationRank, selectLongshots } from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";

type Props = {
  races: Race[];
};

const rankColor: Record<string, string> = {
  S: "bg-signal text-ink",
  A: "bg-turf text-sand",
  B: "bg-turf/20 text-turf",
  C: "bg-ink/10 text-ink/70",
  D: "bg-ink/5 text-ink/40",
};

export function RaceList({ races }: Props) {
  const { settings } = useSettings();
  const allPicks = useMemo(() => selectLongshots(races, settings), [races, settings]);

  const rows = useMemo(() => {
    return [...races]
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((race) => {
        const picks = allPicks.filter((p) => p.raceId === race.id);
        return {
          race,
          pickCount: picks.length,
          rank: raceExpectationRank(picks),
        };
      });
  }, [races, allPicks]);

  return (
    <section id="races" className="bg-sand px-6 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
          JRA RACES
        </p>
        <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">レース一覧</h2>
        <p className="mt-3 max-w-xl text-ink/70">
          期待度は注目穴候補の質と量から算出（Sが最上）。
        </p>

        <ul className="mt-12 divide-y divide-ink/10 border-y border-ink/10">
          {rows.map(({ race, pickCount, rank }) => (
            <li key={race.id}>
              <Link
                href={`/races/${race.id}`}
                className="group flex flex-wrap items-center gap-4 py-5 transition hover:bg-sand-dim/50 md:gap-8"
              >
                <div className="w-28 shrink-0">
                  <p className="font-[family-name:var(--font-display)] text-sm tracking-wider text-turf">
                    {race.venue} {race.raceNumber}R
                  </p>
                  <p className="mt-1 text-ink">{race.startTime}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-semibold text-ink group-hover:text-turf">{race.title}</p>
                  <p className="mt-1 text-sm text-ink/60">
                    {race.distance} · {race.weather}/{race.condition} · 候補 {pickCount}件
                  </p>
                </div>
                <span
                  className={`inline-flex h-9 w-9 items-center justify-center font-[family-name:var(--font-display)] text-sm font-bold ${rankColor[rank]}`}
                  title={`レース期待度 ${rank}`}
                >
                  {rank}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
