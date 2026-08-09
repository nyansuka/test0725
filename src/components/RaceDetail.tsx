"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  classifyOddsEntry,
  enrichHorseScores,
  assignDayExpectationRanks,
  selectLongshots,
  type OddsBoardStatus,
} from "@/domain/longshots";
import { BET_TYPE_LABELS } from "@/domain/betTypes";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { LongshotTable } from "@/components/LongshotTable";
import { LongshotMark, AxisMark, SuperWatchMark, MidPromotedMark, longshotHorseNumbers } from "@/components/LongshotMark";
import Link from "next/link";
import { RaceResultPanel } from "@/components/RaceResultPanel";
import {
  TipsterMark,
  TipsterRefPanel,
  type TipsterRefPayload,
} from "@/components/TipsterRefPanel";
import {
  formatPopularity,
  formatWinOdds,
  placeOddsLabel,
  popularityByNumber,
} from "@/domain/odds";
import { evaluatePick, outcomeLabel } from "@/domain/results";
import { axisIndexByNumber, selectAxisHorses } from "@/domain/axis";
import { filterRacesByDate } from "@/data/races";
import type { TipsterHorseRef } from "@/domain/tipsterRef";

const factorLabels = [
  ["courseFit", "コース"],
  ["paceFit", "展開"],
  ["conditionFit", "馬場"],
  ["formSignal", "近況"],
  ["valueGap", "乖離"],
  ["gateJockey", "枠騎"],
] as const;

const statusLabel: Record<OddsBoardStatus, string> = {
  candidate: "候補",
  pass: "見送り",
  below_threshold: "閾値未満",
  above_max: "上限超過",
  disabled_bet: "券種OFF",
  no_related: "関係馬なし",
};

const statusClass: Record<OddsBoardStatus, string> = {
  candidate: "text-signal font-medium",
  pass: "text-ink/55",
  below_threshold: "text-ink/35",
  above_max: "text-ink/35",
  disabled_bet: "text-ink/30",
  no_related: "text-ink/40",
};

type Props = {
  race: Race;
  /** サーバーで読んだプロ予想。無いレースは null */
  initialTipster?: TipsterRefPayload | null;
};

export function RaceDetail({ race, initialTipster = null }: Props) {
  const { settings } = useSettings();
  const { races: catalogRaces } = useRaceCatalog();
  const { selectedDate } = useRaceDay();
  const horses = useMemo(() => enrichHorseScores(race), [race]);
  const dayRaces = useMemo(() => {
    const date = race.raceDate || selectedDate;
    const fromCatalog = filterRacesByDate(catalogRaces, date);
    if (fromCatalog.some((r) => r.id === race.id)) return fromCatalog;
    return [race];
  }, [catalogRaces, race, selectedDate]);
  const dayPicks = useMemo(
    () => selectLongshots(dayRaces, settings),
    [dayRaces, settings],
  );
  const picks = useMemo(
    () => dayPicks.filter((p) => p.raceId === race.id),
    [dayPicks, race.id],
  );
  const rank = useMemo(() => {
    const map = assignDayExpectationRanks(
      dayRaces.map((r) => ({
        raceId: r.id,
        picks: dayPicks.filter((p) => p.raceId === r.id),
      })),
    );
    return map.get(race.id) ?? "D";
  }, [dayRaces, dayPicks, race.id]);
  const boardRows = useMemo(() => {
    // スコア算出済みのみ（候補・見送り）。閾値未満などは除外
    return race.oddsBoard
      .map((entry) => classifyOddsEntry(race, entry, settings))
      .filter((row) => row.relatedPlacePotential > 0)
      .sort((a, b) => b.relatedPlacePotential - a.relatedPlacePotential);
  }, [race, settings]);
  const scoredCandidateCount = boardRows.filter((r) => r.status === "candidate").length;
  const scoredPassCount = boardRows.filter((r) => r.status === "pass").length;
  const markedHorses = useMemo(() => longshotHorseNumbers(picks, race.id), [picks, race.id]);
  const axisPicks = useMemo(() => selectAxisHorses(race, picks), [race, picks]);
  const axisByNum = useMemo(() => axisIndexByNumber(axisPicks), [axisPicks]);
  const popularity = useMemo(() => popularityByNumber(race.horses), [race.horses]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [tipster, setTipster] = useState<TipsterRefPayload | null>(initialTipster);

  useEffect(() => {
    setTipster(initialTipster);
  }, [race.id, initialTipster]);

  const tipsterByNum = useMemo(() => {
    if (!tipster) return new Map<number, TipsterHorseRef>();
    return new Map(tipster.race.horses.map((h) => [h.number, h]));
  }, [tipster]);

  const horseRows = useMemo(
    () => [...horses].sort((a, b) => (b.placePotential ?? 0) - (a.placePotential ?? 0)),
    [horses],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 pb-4">
        <div className="min-w-0">
          <p className="text-xs text-ink/50">
            <Link href={`/races#venue-${race.venue}`} className="text-turf hover:underline">
              ← {race.venue}
            </Link>
            {" · "}
            {race.raceDate} · {race.raceNumber}R · {race.startTime}
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink sm:text-2xl">{race.title}</h1>
          <p className="mt-1 text-sm text-ink/60">
            {race.distance} · {race.weather}/{race.condition} · 候補 {picks.length}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] tracking-wider text-ink/45">期待度</p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none text-turf">
            {rank}
          </p>
          {tipster?.race.expectation ? (
            <p className="mt-1 text-[11px] text-ink/40">参考 {tipster.race.expectation}</p>
          ) : null}
        </div>
      </div>

      <RaceResultPanel race={race} compact />

      <section>
        <h2 className="text-sm font-semibold text-ink">軸馬候補（Top3）</h2>
        <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
          {axisPicks.map((ax) => {
            const horse = horses.find((h) => h.number === ax.horseNumber);
            return (
              <li
                key={ax.horseNumber}
                className={`flex flex-wrap items-center gap-2 py-1.5 text-sm ${ax.isSuperWatch ? "bg-signal/5" : ""}`}
              >
                <AxisMark rank={ax.rankInRace} />
                {ax.midPromoted ? <MidPromotedMark /> : null}
                {ax.isSuperWatch ? <SuperWatchMark /> : null}
                <span className="font-[family-name:var(--font-display)] font-semibold tabular-nums">
                  {ax.horseNumber}
                </span>
                <span className="font-medium">{horse?.name ?? "—"}</span>
                <span className="text-xs text-ink/50">{horse?.jockey}</span>
                <span className="text-xs font-medium text-signal">
                  {horse ? formatWinOdds(horse.oddsWin) : "—"}
                </span>
                <span className="ml-auto font-[family-name:var(--font-display)] font-semibold text-turf">
                  {ax.winPotential}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">このレースの注目穴</h2>
        <div className="mt-2">
          <LongshotTable
            compact
            picks={picks}
            emptyMessage="このレースに現在の設定で残る候補はありません。"
          />
        </div>
        {race.result && picks.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-ink/65">
            {picks.slice(0, 8).map((pick) => {
              const outcome = evaluatePick(pick, race.result);
              const label = outcomeLabel(outcome);
              const cls =
                outcome === "win"
                  ? "text-signal font-medium"
                  : outcome === "place"
                    ? "text-turf font-medium"
                    : outcome === "miss"
                      ? "text-ink/40"
                      : "text-ink/55";
              return (
                <li key={`${pick.betType}-${pick.selection}`}>
                  <span className={cls}>{label}</span>
                  {" · "}
                  {BET_TYPE_LABELS[pick.betType]} {pick.selection}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {tipster ? <TipsterRefPanel tipster={tipster} /> : null}

      <section>
        <h2 className="text-sm font-semibold text-ink">
          出走表
          <span className="ml-2 text-[11px] font-normal text-ink/45">
            穴
            <LongshotMark className="mx-0.5" />
            · 軸
            <AxisMark className="mx-0.5" />
            · 超注目
            <SuperWatchMark className="mx-0.5 align-middle" />
            {tipster ? " · 参考印" : ""}
            · 行タップで因子
          </span>
        </h2>

        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink/15 bg-sand-dim/50 text-[11px] text-ink/45">
                <th className="w-10 px-1.5 py-1.5 font-medium">印</th>
                <th className="w-10 px-1.5 py-1.5 font-medium">馬番</th>
                <th className="px-1.5 py-1.5 font-medium">馬名</th>
                <th className="px-1.5 py-1.5 font-medium">騎手</th>
                <th className="w-12 px-1.5 py-1.5 font-medium">人気</th>
                <th className="w-14 px-1.5 py-1.5 font-medium">単勝</th>
                <th className="w-16 px-1.5 py-1.5 font-medium">複勝</th>
                {tipster ? <th className="w-12 px-1.5 py-1.5 font-medium">参考</th> : null}
                <th className="w-12 px-1.5 py-1.5 font-medium">穴</th>
                <th className="w-12 px-1.5 py-1.5 font-medium">軸</th>
              </tr>
            </thead>
            <tbody>
              {horseRows.map((horse) => {
                const open = openId === horse.number;
                const marked = markedHorses.has(horse.number);
                const axis = axisByNum.get(horse.number);
                const tip = tipsterByNum.get(horse.number);
                const tipMarked = Boolean(tip?.mark);
                const highlight = marked || Boolean(axis) || tipMarked;
                return (
                  <Fragment key={horse.number}>
                    <tr
                      className={`border-b border-ink/10 ${
                        axis?.isSuperWatch
                          ? "bg-signal/8"
                          : highlight
                            ? "bg-signal/5"
                            : open
                              ? "bg-sand-dim/30"
                              : ""
                      }`}
                    >
                      <td className="px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : horse.number)}
                          className="flex flex-wrap items-center gap-0.5"
                          aria-expanded={open}
                          aria-label={`${horse.number}番の因子を${open ? "閉じる" : "開く"}`}
                        >
                          {marked ? <LongshotMark /> : null}
                          {axis ? <AxisMark rank={axis.rankInRace} /> : null}
                          {axis?.isSuperWatch ? <SuperWatchMark /> : null}
                          {axis?.midPromoted ? <MidPromotedMark /> : null}
                          {tip ? <TipsterMark mark={tip.mark} /> : null}
                          {!marked && !axis && !tip ? (
                            <span className="text-ink/25">{open ? "−" : "+"}</span>
                          ) : null}
                        </button>
                      </td>
                      <td className="px-1.5 py-1 font-[family-name:var(--font-display)] font-semibold tabular-nums">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : horse.number)}
                          className="text-left"
                        >
                          {horse.number}
                        </button>
                      </td>
                      <td className="px-1.5 py-1 font-medium">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : horse.number)}
                          className="text-left hover:text-turf"
                        >
                          {horse.name}
                        </button>
                      </td>
                      <td className="px-1.5 py-1 text-ink/60">{horse.jockey}</td>
                      <td className="px-1.5 py-1">{formatPopularity(popularity.get(horse.number))}</td>
                      <td className="px-1.5 py-1 font-medium text-signal">
                        {formatWinOdds(horse.oddsWin)}
                      </td>
                      <td className="px-1.5 py-1 text-ink/70">{placeOddsLabel(horse, race)}</td>
                      {tipster ? (
                        <td className="px-1.5 py-1 text-xs tabular-nums text-ink/40">
                          {tip?.score ?? "—"}
                        </td>
                      ) : null}
                      <td className="px-1.5 py-1 font-[family-name:var(--font-display)] text-turf">
                        {horse.placePotential}
                      </td>
                      <td className="px-1.5 py-1 font-[family-name:var(--font-display)] text-ink/70">
                        {horse.winPotential ?? "—"}
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-ink/10 bg-sand-dim/25">
                        <td colSpan={tipster ? 10 : 9} className="px-3 py-2.5">
                          <p className="text-xs leading-relaxed text-ink/70">{horse.rationale}</p>
                          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
                            {factorLabels.map(([key, label]) => {
                              const value =
                                key === "gateJockey"
                                  ? (horse.factors.gateJockey ?? 50)
                                  : horse.factors[key];
                              return (
                                <div key={key}>
                                  <div className="flex justify-between text-[10px] text-ink/45">
                                    <span>{label}</span>
                                    <span>{value}</span>
                                  </div>
                                  <div className="mt-0.5 h-1 bg-sand-dim">
                                    <div className="h-full bg-turf" style={{ width: `${value}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-xs text-ink/55">{horse.comment}</p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">オッズ板（スコア付き）</h2>
          <p className="text-[11px] text-ink/45">
            候補 {scoredCandidateCount} · 見送り {scoredPassCount}
            {" · "}スコア算出済みのみ表示
          </p>
        </div>
        {boardRows.length === 0 ? (
          <p className="mt-2 py-4 text-center text-sm text-ink/55">
            スコア付きの買い目がありません。
          </p>
        ) : (
          <div className="mt-2">
            <ul className="space-y-1.5 md:hidden">
              {boardRows.map((row) => (
                <li
                  key={`${row.entry.betType}-${row.entry.selection}`}
                  className="border border-ink/10 bg-sand-dim/20 px-2.5 py-2"
                >
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-[11px] text-ink/50">{BET_TYPE_LABELS[row.entry.betType]}</p>
                      <p className="font-[family-name:var(--font-display)] font-medium">
                        {row.entry.selection}
                      </p>
                    </div>
                    <p className="shrink-0 font-[family-name:var(--font-display)] font-semibold">
                      {row.entry.odds.toFixed(1)}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs">
                    <span className="text-ink/55">スコア {row.relatedPlacePotential}</span>
                    <span className={statusClass[row.status]}>
                      {statusLabel[row.status]}
                      {row.label ? `（${row.label}）` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-ink/15 bg-sand-dim/50 text-ink/45">
                    <th className="px-2 py-1.5 font-medium">券種</th>
                    <th className="px-2 py-1.5 font-medium">買い目</th>
                    <th className="px-2 py-1.5 font-medium">オッズ</th>
                    <th className="px-2 py-1.5 font-medium">スコア</th>
                    <th className="px-2 py-1.5 font-medium">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {boardRows.map((row) => (
                    <tr
                      key={`${row.entry.betType}-${row.entry.selection}`}
                      className={`border-b border-ink/10 ${
                        row.status === "candidate" ? "bg-signal/5" : ""
                      }`}
                    >
                      <td className="px-2 py-1">{BET_TYPE_LABELS[row.entry.betType]}</td>
                      <td className="px-2 py-1 font-[family-name:var(--font-display)] font-medium">
                        {row.entry.selection}
                      </td>
                      <td className="px-2 py-1 tabular-nums">{row.entry.odds.toFixed(1)}</td>
                      <td className="px-2 py-1 font-medium text-turf">{row.relatedPlacePotential}</td>
                      <td className={`px-2 py-1 ${statusClass[row.status]}`}>
                        {statusLabel[row.status]}
                        {row.label ? `（${row.label}）` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
