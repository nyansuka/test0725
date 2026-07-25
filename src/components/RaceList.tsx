"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  EXPECTATION_RANK_HELP,
  enrichHorseScores,
  raceExpectationRank,
  selectLongshots,
} from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { RaceDayPicker } from "@/components/RaceDayPicker";
import { filterRacesByDate, groupRacesByVenue } from "@/data/races";
import { LongshotMark, longshotHorseNumbers } from "@/components/LongshotMark";
import { formatJstDateLabel } from "@/domain/date";
import { formatFinishLine, raceHasResult } from "@/domain/results";
import {
  formatPopularity,
  formatPopularityParen,
  formatWinOdds,
  placeOddsLabel,
  popularityByNumber,
} from "@/domain/odds";

type Props = {
  races?: Race[];
};

const rankColor: Record<string, string> = {
  S: "bg-signal text-ink",
  A: "bg-turf text-sand",
  B: "bg-turf/20 text-turf",
  C: "bg-ink/10 text-ink/70",
  D: "bg-ink/5 text-ink/40",
};

export function RaceList({ races: racesProp }: Props) {
  const { races: catalogRaces } = useRaceCatalog();
  const races = racesProp ?? catalogRaces;
  const { settings } = useSettings();
  const { selectedDate } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );
  const allPicks = useMemo(
    () => selectLongshots(dayRaces, settings),
    [dayRaces, settings],
  );

  const groups = useMemo(() => {
    return groupRacesByVenue(dayRaces).map(({ venue, races: venueRaces }) => ({
      venue,
      races: venueRaces.map((race) => {
        const picks = allPicks.filter((p) => p.raceId === race.id);
        return {
          race,
          picks,
          pickCount: picks.length,
          rank: raceExpectationRank(picks),
          markedHorses: longshotHorseNumbers(picks, race.id),
        };
      }),
    }));
  }, [dayRaces, allPicks]);

  const [activeVenue, setActiveVenue] = useState(groups[0]?.venue ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (groups.length === 0) {
      setActiveVenue("");
      return;
    }
    if (!groups.some((g) => g.venue === activeVenue)) {
      setActiveVenue(groups[0].venue);
      setExpandedId(null);
    }
  }, [groups, activeVenue]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = decodeURIComponent(window.location.hash.replace(/^#venue-/, ""));
    if (hash && groups.some((g) => g.venue === hash)) {
      setActiveVenue(hash);
    }
  }, [groups]);

  function selectVenue(venue: string) {
    setActiveVenue(venue);
    setExpandedId(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#venue-${venue}`);
    }
  }

  const activeGroup = groups.find((g) => g.venue === activeVenue) ?? groups[0];

  return (
    <section id="races" className="bg-sand px-6 py-20 md:px-8 md:py-24">
      <div className="mx-auto max-w-6xl">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
          JRA RACES
        </p>
        <h2 className="mt-2 text-3xl font-bold text-ink md:text-4xl">レース一覧</h2>
        <p className="mt-3 max-w-2xl text-ink/70">
          開催日を選び、会場タブで全レース（1〜12R）を確認できます。注目穴馬には
          <LongshotMark className="mx-0.5" /> が付きます。{EXPECTATION_RANK_HELP}
        </p>

        <div className="mt-8">
          <RaceDayPicker />
        </div>

        {groups.length === 0 ? (
          <p className="mt-12 border border-ink/10 bg-sand-dim/40 px-6 py-10 text-center text-ink/60">
            {formatJstDateLabel(selectedDate)} の開催データがありません。別の日を選ぶか「本日に戻す」を押してください。
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="開催場"
          className="mt-8 flex flex-wrap gap-2 border-b border-ink/15 pb-0"
        >
          {groups.map(({ venue, races: venueRaces }) => {
            const selected = venue === activeGroup?.venue;
            return (
              <button
                key={venue}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`tab-${venue}`}
                onClick={() => selectVenue(venue)}
                className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${
                  selected
                    ? "border-turf text-turf"
                    : "border-transparent text-ink/55 hover:text-ink"
                }`}
              >
                {venue}
                <span className="ml-2 text-xs font-normal text-ink/40">{venueRaces.length}R</span>
              </button>
            );
          })}
        </div>

        {activeGroup && (
          <div
            role="tabpanel"
            aria-labelledby={`tab-${activeGroup.venue}`}
            className="mt-8"
          >
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <h3 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-wide text-turf">
                {activeGroup.venue}
              </h3>
              <p className="text-sm text-ink/50">全 {activeGroup.races.length} レース</p>
            </div>

            <ul className="divide-y divide-ink/10 border-y border-ink/10">
              {activeGroup.races.map(({ race, picks, pickCount, rank, markedHorses }) => {
                const open = expandedId === race.id;
                const horses = open ? enrichHorseScores(race) : [];
                return (
                  <li key={race.id} id={race.id}>
                    <div className="flex flex-wrap items-stretch gap-2 py-3 md:gap-4">
                      <button
                        type="button"
                        onClick={() => setExpandedId(open ? null : race.id)}
                        className="group flex min-w-0 flex-1 flex-wrap items-center gap-4 py-2 text-left transition hover:bg-sand-dim/40 md:gap-8"
                        aria-expanded={open}
                      >
                        <div className="w-24 shrink-0">
                          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
                            {race.raceNumber}R
                          </p>
                          <p className="mt-0.5 text-sm text-ink/60">{race.startTime}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-lg font-semibold text-ink group-hover:text-turf">
                            {race.title}
                            {markedHorses.size > 0 && (
                              <LongshotMark className="ml-2 text-base" />
                            )}
                            {raceHasResult(race) && (
                              <span className="ml-2 text-xs font-medium tracking-wide text-turf">
                                結果済
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-ink/60">
                            {race.distance} · {race.weather}/{race.condition} · 候補 {pickCount}件
                            · 注目穴馬 {markedHorses.size}頭
                            {raceHasResult(race) && race.result
                              ? ` · ${formatFinishLine(race.result)}`
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center font-[family-name:var(--font-display)] text-sm font-bold ${rankColor[rank]}`}
                          title={`レース期待度 ${rank}`}
                        >
                          {rank}
                        </span>
                        <span className="w-6 text-center text-ink/40" aria-hidden>
                          {open ? "−" : "+"}
                        </span>
                      </button>
                      <Link
                        href={`/races/${race.id}`}
                        className="shrink-0 self-center px-3 py-2 text-sm text-turf hover:underline"
                      >
                        詳細
                      </Link>
                    </div>

                    {open && (
                      <div className="mb-4 border border-ink/10 bg-sand-dim/30 px-4 py-4">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink/65">
                          <span>発走 {race.startTime}</span>
                          <span>{race.track}</span>
                          <span>頭数 {race.horses.length}</span>
                          <span>期待度 {rank}</span>
                        </div>

                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full min-w-[640px] text-left text-sm">
                            <thead>
                              <tr className="border-b border-ink/15 text-ink/45">
                                <th className="py-2 pr-2 font-medium">印</th>
                                <th className="py-2 pr-2 font-medium">馬番</th>
                                <th className="py-2 pr-2 font-medium">馬名</th>
                                <th className="py-2 pr-2 font-medium">騎手</th>
                                <th className="py-2 pr-2 font-medium">人気</th>
                                <th className="py-2 pr-2 font-medium">単勝</th>
                                <th className="py-2 pr-2 font-medium">複勝</th>
                                <th className="py-2 font-medium">スコア</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const pop = popularityByNumber(horses);
                                return [...horses]
                                  .sort((a, b) => a.number - b.number)
                                  .map((horse) => {
                                    const marked = markedHorses.has(horse.number);
                                    return (
                                      <tr
                                        key={horse.number}
                                        className={`border-b border-ink/10 ${marked ? "bg-signal/5" : ""}`}
                                      >
                                        <td className="w-8 py-2 pr-2">
                                          {marked ? <LongshotMark /> : null}
                                        </td>
                                        <td className="py-2 pr-2 font-[family-name:var(--font-display)] font-semibold">
                                          {horse.number}
                                        </td>
                                        <td className="py-2 pr-2 font-medium">{horse.name}</td>
                                        <td className="py-2 pr-2 text-ink/60">{horse.jockey}</td>
                                        <td className="py-2 pr-2 font-medium text-ink">
                                          {formatPopularity(pop.get(horse.number))}
                                        </td>
                                        <td className="py-2 pr-2 font-medium text-signal">
                                          {formatWinOdds(horse.oddsWin)}
                                        </td>
                                        <td className="py-2 pr-2 text-ink/70">
                                          {placeOddsLabel(horse, race)}
                                        </td>
                                        <td className="py-2 font-[family-name:var(--font-display)] text-turf">
                                          {horse.placePotential}
                                        </td>
                                      </tr>
                                    );
                                  });
                              })()}
                            </tbody>
                          </table>
                        </div>

                        {picks.length > 0 && (
                          <div className="mt-4">
                            <p className="text-xs tracking-wider text-ink/45">このレースの候補</p>
                            <ul className="mt-2 space-y-1 text-sm text-ink/75">
                              {picks.slice(0, 6).map((pick) => {
                                const pop = popularityByNumber(race.horses);
                                const popLabel = pick.relatedHorseNumbers
                                  .map((n) => formatPopularityParen(pop.get(n)))
                                  .filter(Boolean)
                                  .join("");
                                return (
                                  <li key={`${pick.betType}-${pick.selection}`}>
                                    {pick.label === "注目穴" && (
                                      <LongshotMark className="mr-1" />
                                    )}
                                    {pick.label} · {pick.selection}
                                    {popLabel ? ` ${popLabel}` : ""} · {formatWinOdds(pick.odds)} ·
                                    スコア {pick.relatedPlacePotential}
                                  </li>
                                );
                              })}
                              {picks.length > 6 && (
                                <li className="text-ink/45">ほか {picks.length - 6} 件…</li>
                              )}
                            </ul>
                          </div>
                        )}

                        <Link
                          href={`/races/${race.id}`}
                          className="mt-4 inline-flex text-sm font-medium text-turf hover:underline"
                        >
                          レース詳細へ（カテゴリ内訳・オッズ板）
                        </Link>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
