"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  enrichHorseScores,
  assignDayExpectationRanks,
  selectLongshots,
} from "@/domain/longshots";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { filterRacesByDate, groupRacesByVenue } from "@/data/races";
import { LongshotMark, AxisMark, SuperWatchMark, longshotHorseNumbers } from "@/components/LongshotMark";
import { formatJstDateLabel } from "@/domain/date";
import { formatFinishLine, raceHasResult } from "@/domain/results";
import {
  formatPopularity,
  formatPopularityParen,
  formatWinOdds,
  placeOddsLabel,
  popularityByNumber,
} from "@/domain/odds";
import { axisIndexByNumber, selectAxisHorses } from "@/domain/axis";

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
    const dayRankById = assignDayExpectationRanks(
      dayRaces.map((race) => ({
        raceId: race.id,
        picks: allPicks.filter((p) => p.raceId === race.id),
      })),
    );
    return groupRacesByVenue(dayRaces).map(({ venue, races: venueRaces }) => ({
      venue,
      races: venueRaces.map((race) => {
        const picks = allPicks.filter((p) => p.raceId === race.id);
        const axis = selectAxisHorses(race, picks);
        return {
          race,
          picks,
          pickCount: picks.length,
          rank: dayRankById.get(race.id) ?? "D",
          markedHorses: longshotHorseNumbers(picks, race.id),
          axisByNum: axisIndexByNumber(axis),
          superWatchCount: axis.filter((a) => a.isSuperWatch).length,
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
    <section id="races" className="bg-sand px-4 py-8 sm:px-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-ink sm:text-xl">開催レース一覧</h2>
            <p className="mt-1 text-xs text-ink/55 sm:text-sm">
              {formatJstDateLabel(selectedDate)} · 穴
              <LongshotMark className="mx-0.5" />
              · 超注目
              <SuperWatchMark className="mx-0.5 align-middle" />
              · 期待度は開催日内の相対評価（S〜D）
            </p>
          </div>
          {activeGroup ? (
            <p className="text-xs text-ink/45">{activeGroup.venue} {activeGroup.races.length}R</p>
          ) : null}
        </div>

        {groups.length === 0 ? (
          <p className="mt-6 border border-ink/10 bg-sand-dim/40 px-4 py-8 text-center text-sm text-ink/60">
            {formatJstDateLabel(selectedDate)} の開催データがありません。ヘッダーの開催日を変更してください。
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="開催場"
          className="mt-4 flex gap-0 overflow-x-auto border-b border-ink/20"
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
                className={`shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition sm:px-4 ${
                  selected
                    ? "border-turf bg-turf/5 text-turf"
                    : "border-transparent text-ink/55 hover:bg-sand-dim/60 hover:text-ink"
                }`}
              >
                {venue}
                <span className="ml-1.5 text-[11px] font-normal text-ink/40">{venueRaces.length}</span>
              </button>
            );
          })}
        </div>

        {activeGroup && (
          <div
            role="tabpanel"
            aria-labelledby={`tab-${activeGroup.venue}`}
            className="mt-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/15 bg-sand-dim/50 text-[11px] tracking-wide text-ink/45">
                    <th className="w-12 px-2 py-1.5 font-medium">R</th>
                    <th className="w-14 px-2 py-1.5 font-medium">発走</th>
                    <th className="px-2 py-1.5 font-medium">レース名</th>
                    <th className="w-24 px-2 py-1.5 font-medium">距離</th>
                    <th className="w-20 px-2 py-1.5 font-medium">天候/馬場</th>
                    <th className="w-16 px-2 py-1.5 font-medium">候補</th>
                    <th className="w-10 px-2 py-1.5 text-center font-medium">印</th>
                    <th className="w-9 px-2 py-1.5 text-center font-medium">期待</th>
                    <th className="w-12 px-2 py-1.5 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {activeGroup.races.map(
                    ({ race, picks, pickCount, rank, markedHorses, axisByNum, superWatchCount }) => {
                      const open = expandedId === race.id;
                      const horses = open ? enrichHorseScores(race) : [];
                      const done = raceHasResult(race);
                      return (
                        <Fragment key={race.id}>
                          <tr
                            id={race.id}
                            className={`border-b border-ink/10 transition hover:bg-sand-dim/40 ${
                              open ? "bg-sand-dim/30" : ""
                            } ${done ? "text-ink/55" : ""}`}
                          >
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : race.id)}
                                className={`font-[family-name:var(--font-display)] text-sm font-bold tabular-nums ${
                                  done ? "text-ink/50" : "text-ink"
                                }`}
                                aria-expanded={open}
                              >
                                {race.raceNumber}R
                              </button>
                            </td>
                            <td className="px-2 py-1.5 tabular-nums text-ink/70">{race.startTime}</td>
                            <td className="px-2 py-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedId(open ? null : race.id)}
                                className="group flex max-w-full items-center gap-1.5 text-left"
                                aria-expanded={open}
                              >
                                <span
                                  className={`truncate font-medium group-hover:text-turf ${
                                    done ? "text-ink/60" : "text-ink"
                                  }`}
                                >
                                  {race.title}
                                </span>
                                {done ? (
                                  <span className="shrink-0 rounded-sm bg-ink/8 px-1 py-0.5 text-[10px] font-medium tracking-wide text-ink/55">
                                    結果
                                  </span>
                                ) : null}
                              </button>
                              {done && race.result ? (
                                <p className="mt-0.5 truncate text-[11px] text-ink/45">
                                  {formatFinishLine(race.result)}
                                </p>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5 text-ink/65">
                              <span className="tabular-nums">{race.distance}</span>
                            </td>
                            <td className="px-2 py-1.5 text-xs text-ink/55">
                              {race.weather}/{race.condition}
                            </td>
                            <td className="px-2 py-1.5 tabular-nums text-ink/65">
                              {pickCount}
                              <span className="text-ink/35">/</span>
                              {markedHorses.size}
                              {superWatchCount > 0 ? (
                                <span className="ml-0.5 text-signal">+{superWatchCount}</span>
                              ) : null}
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span className="inline-flex items-center justify-center gap-0.5">
                                {markedHorses.size > 0 ? <LongshotMark className="text-sm" /> : null}
                                {superWatchCount > 0 ? (
                                  <SuperWatchMark className="align-middle text-sm" />
                                ) : null}
                                {markedHorses.size === 0 && superWatchCount === 0 ? (
                                  <span className="text-ink/25">·</span>
                                ) : null}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <span
                                className={`inline-flex h-6 w-6 items-center justify-center font-[family-name:var(--font-display)] text-xs font-bold ${rankColor[rank]}`}
                                title={`レース期待度 ${rank}`}
                              >
                                {rank}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Link
                                href={`/races/${race.id}`}
                                className="text-xs text-turf hover:underline"
                              >
                                詳細
                              </Link>
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-b border-ink/10 bg-sand-dim/25">
                              <td colSpan={9} className="px-3 py-3">
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
                                  <span>発走 {race.startTime}</span>
                                  <span>{race.track}</span>
                                  <span>頭数 {race.horses.length}</span>
                                  <span>期待度 {rank}</span>
                                  <span>候補 {pickCount} · 穴 {markedHorses.size}
                                    {superWatchCount > 0 ? ` · 超注目 ${superWatchCount}` : ""}
                                  </span>
                                </div>

                                {(() => {
                                  const pop = popularityByNumber(horses);
                                  const rows = [...horses].sort((a, b) => a.number - b.number);
                                  return (
                                    <>
                                      <ul className="mt-3 space-y-1.5 md:hidden">
                                        {rows.map((horse) => {
                                          const marked = markedHorses.has(horse.number);
                                          const axis = axisByNum.get(horse.number);
                                          return (
                                            <li
                                              key={horse.number}
                                              className={`border border-ink/10 px-2.5 py-2 text-sm ${
                                                axis?.isSuperWatch
                                                  ? "bg-signal/8"
                                                  : marked || axis
                                                    ? "bg-signal/5"
                                                    : "bg-sand"
                                              }`}
                                            >
                                              <div className="flex items-start gap-2">
                                                <span className="flex min-w-[2rem] flex-wrap items-center gap-0.5">
                                                  {marked ? <LongshotMark /> : null}
                                                  {axis ? <AxisMark rank={axis.rankInRace} /> : null}
                                                  {axis?.isSuperWatch ? <SuperWatchMark /> : null}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                  <p className="font-medium text-ink">
                                                    <span className="mr-1.5 font-[family-name:var(--font-display)] font-semibold tabular-nums">
                                                      {horse.number}
                                                    </span>
                                                    {horse.name}
                                                  </p>
                                                  <p className="mt-0.5 text-[11px] text-ink/55">
                                                    {horse.jockey} · {formatPopularity(pop.get(horse.number))} ·
                                                    単 {formatWinOdds(horse.oddsWin)} · 複{" "}
                                                    {placeOddsLabel(horse, race)}
                                                  </p>
                                                </div>
                                                <div className="shrink-0 text-right text-[11px]">
                                                  <p className="font-[family-name:var(--font-display)] text-sm text-turf">
                                                    穴 {horse.placePotential}
                                                  </p>
                                                  <p className="text-ink/55">軸 {horse.winPotential ?? "—"}</p>
                                                </div>
                                              </div>
                                            </li>
                                          );
                                        })}
                                      </ul>
                                      <div className="mt-3 hidden overflow-x-auto md:block">
                                        <table className="w-full min-w-[600px] text-left text-xs">
                                          <thead>
                                            <tr className="border-b border-ink/15 text-ink/45">
                                              <th className="py-1 pr-2 font-medium">印</th>
                                              <th className="py-1 pr-2 font-medium">馬番</th>
                                              <th className="py-1 pr-2 font-medium">馬名</th>
                                              <th className="py-1 pr-2 font-medium">騎手</th>
                                              <th className="py-1 pr-2 font-medium">人気</th>
                                              <th className="py-1 pr-2 font-medium">単勝</th>
                                              <th className="py-1 pr-2 font-medium">複勝</th>
                                              <th className="py-1 pr-2 font-medium">穴</th>
                                              <th className="py-1 font-medium">軸</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {rows.map((horse) => {
                                              const marked = markedHorses.has(horse.number);
                                              const axis = axisByNum.get(horse.number);
                                              return (
                                                <tr
                                                  key={horse.number}
                                                  className={`border-b border-ink/8 ${
                                                    axis?.isSuperWatch
                                                      ? "bg-signal/8"
                                                      : marked || axis
                                                        ? "bg-signal/5"
                                                        : ""
                                                  }`}
                                                >
                                                  <td className="py-1 pr-2">
                                                    <span className="flex flex-wrap items-center gap-0.5">
                                                      {marked ? <LongshotMark /> : null}
                                                      {axis ? <AxisMark rank={axis.rankInRace} /> : null}
                                                      {axis?.isSuperWatch ? <SuperWatchMark /> : null}
                                                    </span>
                                                  </td>
                                                  <td className="py-1 pr-2 font-[family-name:var(--font-display)] font-semibold tabular-nums">
                                                    {horse.number}
                                                  </td>
                                                  <td className="py-1 pr-2 font-medium">{horse.name}</td>
                                                  <td className="py-1 pr-2 text-ink/60">{horse.jockey}</td>
                                                  <td className="py-1 pr-2">{formatPopularity(pop.get(horse.number))}</td>
                                                  <td className="py-1 pr-2 font-medium text-signal">
                                                    {formatWinOdds(horse.oddsWin)}
                                                  </td>
                                                  <td className="py-1 pr-2 text-ink/70">
                                                    {placeOddsLabel(horse, race)}
                                                  </td>
                                                  <td className="py-1 pr-2 font-[family-name:var(--font-display)] text-turf">
                                                    {horse.placePotential}
                                                  </td>
                                                  <td className="py-1 font-[family-name:var(--font-display)] text-ink/70">
                                                    {horse.winPotential ?? "—"}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  );
                                })()}

                                {picks.length > 0 && (
                                  <div className="mt-3">
                                    <p className="text-[11px] tracking-wider text-ink/45">このレースの候補</p>
                                    <ul className="mt-1 space-y-0.5 text-xs text-ink/75">
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
                                            {pick.hasSuperWatch && (
                                              <SuperWatchMark className="mr-1 align-middle" />
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
                                  className="mt-3 inline-flex text-xs font-medium text-turf hover:underline"
                                >
                                  レース詳細へ（カテゴリ内訳・オッズ板）
                                </Link>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink/40">
              候補列は「全候補 / 注目穴頭数」。R・レース名クリックで出馬を展開。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
