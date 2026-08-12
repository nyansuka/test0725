"use client";

import { useEffect, useMemo, useState } from "react";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useRaceDay } from "@/components/RaceDayProvider";
import { SanrenLabTable } from "@/components/SanrenLabTable";
import { filterRacesByDate } from "@/data/races";
import { formatJstDateLabel } from "@/domain/date";
import { findPayoutYen } from "@/domain/results";
import {
  DEFAULT_TRIO_LANE,
  DEFAULT_TRIFECTA_LANE,
  selectTrioLab,
  selectTrifectaLab,
  summarizeSanrenLabDensity,
} from "@/domain/sanrenLab";
import type { Race, SanrenBetType, SanrenLaneSettings, SanrenPick } from "@/domain/types";

type SortKey = "score" | "odds" | "time";

type Props = {
  lane: SanrenBetType;
  races?: Race[];
};

function cloneLane(lane: SanrenBetType): SanrenLaneSettings {
  return lane === "trio"
    ? { ...DEFAULT_TRIO_LANE }
    : { ...DEFAULT_TRIFECTA_LANE };
}

function TicketSummaryBar({
  picks,
  races,
}: {
  picks: SanrenPick[];
  races: Race[];
}) {
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const summary = useMemo(() => {
    let hits = 0;
    let misses = 0;
    let pending = 0;
    for (const p of picks) {
      const race = byId.get(p.raceId);
      if (!race?.result?.finishes?.length) {
        pending += 1;
        continue;
      }
      const yen = findPayoutYen(race.result, p.betType, p.selection);
      if (yen != null && yen > 0) hits += 1;
      else misses += 1;
    }
    const settled = hits + misses;
    return {
      hits,
      misses,
      pending,
      settled,
      rate: settled === 0 ? null : Math.round((hits / settled) * 1000) / 10,
    };
  }, [picks, byId]);

  if (picks.length === 0) return null;

  return (
    <section
      aria-label="買い目的中サマリー"
      className="border border-turf/30 bg-turf/5 px-4 py-4 md:px-5"
    >
      <p className="text-xs font-medium tracking-wider text-turf">
        ticketHit（払戻突合）
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
          {summary.rate == null ? "—" : `${summary.rate}%`}
        </p>
        <p className="text-sm text-ink/70">
          的中 {summary.hits} / 確定 {summary.settled}
          {summary.pending > 0 ? ` · 待ち ${summary.pending}` : ""}
          {" · "}
          はずれ {summary.misses}
        </p>
      </div>
      <p className="mt-1 text-xs text-ink/50">
        研究所は複勝圏ヒットではなく実払戻の的中を主指標にします
      </p>
    </section>
  );
}

export function SanrenLabBoard({ lane, races: racesProp }: Props) {
  const { races: catalogRaces } = useRaceCatalog();
  const races = racesProp ?? catalogRaces;
  const { selectedDate } = useRaceDay();
  const dayRaces = useMemo(
    () => filterRacesByDate(races, selectedDate),
    [races, selectedDate],
  );

  const [laneSettings, setLaneSettings] = useState<SanrenLaneSettings>(() =>
    cloneLane(lane),
  );
  const [sort, setSort] = useState<SortKey>("score");
  const [venue, setVenue] = useState<string>("all");
  const [track, setTrack] = useState<"all" | "芝" | "ダート">("all");

  useEffect(() => {
    setLaneSettings(cloneLane(lane));
  }, [lane]);

  const venues = useMemo(
    () => [...new Set(dayRaces.map((r) => r.venue))],
    [dayRaces],
  );

  useEffect(() => {
    if (venue !== "all" && !venues.includes(venue)) setVenue("all");
  }, [venues, venue]);

  const picks = useMemo(() => {
    const raw =
      lane === "trio"
        ? selectTrioLab(dayRaces, laneSettings)
        : selectTrifectaLab(dayRaces, laneSettings);
    let list = raw;
    if (venue !== "all") list = list.filter((p) => p.venue === venue);
    if (track !== "all") list = list.filter((p) => p.track === track);

    if (sort === "odds") return [...list].sort((a, b) => b.odds - a.odds);
    if (sort === "time") {
      return [...list].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return [...list].sort((a, b) => {
      if (b.relatedScore !== a.relatedScore) return b.relatedScore - a.relatedScore;
      return b.odds - a.odds;
    });
  }, [dayRaces, lane, laneSettings, venue, track, sort]);

  const density = useMemo(() => summarizeSanrenLabDensity(picks), [picks]);

  const defaultThreshold =
    lane === "trio"
      ? DEFAULT_TRIO_LANE.oddsThreshold
      : DEFAULT_TRIFECTA_LANE.oddsThreshold;

  return (
    <div>
      <div className="mb-4">
        <p className="text-sm text-ink/55">
          表示対象: {formatJstDateLabel(selectedDate)}
          {dayRaces.length === 0
            ? "（開催なし）"
            : ` · ${dayRaces.length} レース`}
          <span className="text-ink/40"> · 開催日は上部バーで変更</span>
        </p>
      </div>

      <div className="flex flex-col gap-6 border border-ink/10 bg-sand-dim/40 p-5 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-ink/60">
              オッズ閾値（以上 · 既定 {defaultThreshold}）
            </span>
            <input
              type="number"
              min={1}
              step={1}
              value={laneSettings.oddsThreshold}
              onChange={(e) =>
                setLaneSettings((s) => ({
                  ...s,
                  oddsThreshold: Number(e.target.value) || 1,
                }))
              }
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">オッズ上限（以下）</span>
            <input
              type="number"
              min={1}
              step={1}
              value={laneSettings.oddsMax ?? ""}
              placeholder="なし"
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") {
                  setLaneSettings((s) => ({ ...s, oddsMax: null }));
                  return;
                }
                const n = Number(raw);
                setLaneSettings((s) => ({
                  ...s,
                  oddsMax: Number.isFinite(n) && n > 0 ? n : null,
                }));
              }}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">会場</span>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="all">すべて</option>
              {venues.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">芝／ダート</span>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value as typeof track)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="all">すべて</option>
              <option value="芝">芝</option>
              <option value="ダート">ダート</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink/60">ソート</span>
          {(
            [
              ["score", "スコア順"],
              ["odds", "オッズ順"],
              ["time", "発走順"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key)}
              className={`border px-3 py-1.5 transition ${
                sort === key
                  ? "border-turf bg-turf text-sand"
                  : "border-ink/15 text-ink/70 hover:border-ink/40"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-ink/50">
            {density.pickCount} 点 · {density.raceCount} R
            {density.raceCount > 0
              ? ` · 平均 ${density.avgPerRace.toFixed(1)} 点/R`
              : ""}
            {" · "}最低スコア {laneSettings.scoreMin}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <TicketSummaryBar picks={picks} races={races} />
      </div>

      <div className="mt-6">
        <SanrenLabTable
          picks={picks}
          emptyMessage={
            dayRaces.length === 0
              ? "この日の開催データがありません。"
              : "閾値・板カバレッジの条件に合う候補がありません。"
          }
        />
      </div>
    </div>
  );
}
