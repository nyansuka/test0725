"use client";

import { useMemo, useState } from "react";
import { enrichHorseScores, raceExpectationRank, selectLongshots } from "@/domain/longshots";
import { BET_TYPE_LABELS } from "@/domain/betTypes";
import type { Race } from "@/domain/types";
import { useSettings } from "@/components/SettingsProvider";
import { LongshotTable } from "@/components/LongshotTable";

const factorLabels = [
  ["courseFit", "コース"],
  ["paceFit", "展開"],
  ["conditionFit", "馬場"],
  ["formSignal", "近況"],
  ["valueGap", "乖離"],
  ["gateJockey", "枠騎"],
] as const;

type Props = {
  race: Race;
};

export function RaceDetail({ race }: Props) {
  const { settings } = useSettings();
  const horses = useMemo(() => enrichHorseScores(race), [race]);
  const picks = useMemo(
    () => selectLongshots([race], settings),
    [race, settings],
  );
  const rank = raceExpectationRank(picks);
  const [openId, setOpenId] = useState<number | null>(horses[0]?.number ?? null);

  return (
    <div className="space-y-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            {race.venue} {race.raceNumber}R · {race.startTime} · JRA
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink md:text-5xl">{race.title}</h1>
          <p className="mt-3 text-ink/70">
            {race.distance} · {race.weather} / {race.condition}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-wider text-ink/50">レース期待度</p>
          <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-turf">{rank}</p>
          <p className="mt-1 text-sm text-ink/50">候補 {picks.length} 件</p>
        </div>
      </div>

      <section>
        <h2 className="text-xl font-semibold text-ink">このレースの注目穴</h2>
        <div className="mt-4">
          <LongshotTable picks={picks} emptyMessage="このレースに現在の設定で残る候補はありません。" />
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-ink">出走表とカテゴリ内訳</h2>
        <div className="mt-6 space-y-3">
          {[...horses]
            .sort((a, b) => (b.placePotential ?? 0) - (a.placePotential ?? 0))
            .map((horse) => {
              const open = openId === horse.number;
              return (
                <div key={horse.number} className="border border-ink/10 bg-sand-dim/30">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : horse.number)}
                    className="flex w-full flex-wrap items-center gap-4 px-4 py-4 text-left"
                  >
                    <span className="font-[family-name:var(--font-display)] text-xl font-semibold w-8">
                      {horse.number}
                    </span>
                    <span className="min-w-[8rem] font-medium">{horse.name}</span>
                    <span className="text-sm text-ink/60">{horse.jockey}</span>
                    <span className="text-sm">単勝 {horse.oddsWin.toFixed(1)}</span>
                    <span className="ml-auto font-[family-name:var(--font-display)] text-lg font-semibold text-turf">
                      {horse.placePotential}
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-ink/10 px-4 py-4">
                      <p className="text-sm leading-relaxed text-ink/70">{horse.rationale}</p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                        {factorLabels.map(([key, label]) => {
                          const value =
                            key === "gateJockey"
                              ? (horse.factors.gateJockey ?? 50)
                              : horse.factors[key];
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-xs text-ink/50">
                                <span>{label}</span>
                                <span>{value}</span>
                              </div>
                              <div className="mt-1 h-1.5 bg-sand-dim">
                                <div className="h-full bg-turf" style={{ width: `${value}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-sm text-ink/60">{horse.comment}</p>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-ink">オッズ板（サンプル）</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/20 text-ink/50">
                <th className="py-2 pr-3 font-medium">券種</th>
                <th className="py-2 pr-3 font-medium">買い目</th>
                <th className="py-2 font-medium">オッズ</th>
              </tr>
            </thead>
            <tbody>
              {race.oddsBoard.map((entry) => (
                <tr
                  key={`${entry.betType}-${entry.selection}`}
                  className="border-b border-ink/10"
                >
                  <td className="py-2 pr-3">{BET_TYPE_LABELS[entry.betType]}</td>
                  <td className="py-2 pr-3 font-[family-name:var(--font-display)]">
                    {entry.selection}
                  </td>
                  <td className="py-2">{entry.odds.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
