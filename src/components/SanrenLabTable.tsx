"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { AxisMark, SuperWatchMark } from "@/components/LongshotMark";
import { BET_TYPE_LABELS } from "@/domain/betTypes";
import {
  findPayoutYen,
  horseFinishRank,
  outcomeLabel,
  evaluateHorse,
} from "@/domain/results";
import {
  formatPopularityParen,
  formatWinOdds,
  popularityByNumber,
} from "@/domain/odds";
import type { Race, SanrenPick, SanrenPickPattern } from "@/domain/types";

const PATTERN_LABELS: Record<SanrenPickPattern, string> = {
  fav_fav_hole: "人気×人気×穴",
  ordered_axis: "1着固定",
  other: "その他",
};

function ticketLabel(
  pick: SanrenPick,
  race: Race | undefined,
): { text: string; className: string } {
  if (!race?.result?.finishes?.length) {
    return { text: "待ち", className: "text-ink/55" };
  }
  if (pick.odds == null) {
    return { text: "板なし", className: "text-ink/40" };
  }
  const yen = findPayoutYen(race.result, pick.betType, pick.selection);
  if (yen != null && yen > 0) {
    return {
      text: `的中 · ¥${yen.toLocaleString("ja-JP")}`,
      className: "font-medium text-signal",
    };
  }
  return { text: "はずれ", className: "text-ink/40" };
}

function HorseChip({
  number,
  race,
  role,
  showOutcome,
}: {
  number: number;
  race: Race | undefined;
  role?: string;
  showOutcome: boolean;
}) {
  const horse = race?.horses.find((h) => h.number === number);
  const pop = race ? popularityByNumber(race.horses).get(number) : undefined;
  const finish = showOutcome ? horseFinishRank(number, race?.result) : null;
  const outcome = showOutcome ? evaluateHorse(number, race?.result) : "pending";

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1">
      {role ? <span className="text-[11px] text-ink/45">{role}</span> : null}
      <span className="tabular-nums font-semibold text-ink">{number}</span>
      {horse ? <span className="text-sm font-medium text-ink/80">{horse.name}</span> : null}
      {pop != null ? (
        <span className="text-xs text-ink/55">{formatPopularityParen(pop)}</span>
      ) : null}
      {showOutcome && finish != null ? (
        <span
          className={
            outcome === "win"
              ? "text-xs font-medium text-signal"
              : outcome === "place"
                ? "text-xs font-medium text-turf"
                : "text-xs text-ink/40"
          }
        >
          {finish}着 · {outcomeLabel(outcome)}
        </span>
      ) : null}
    </span>
  );
}

type Props = {
  picks: SanrenPick[];
  /** 渡すと当日全レースを見出しする（候補0件のRも含む） */
  dayRaces?: Race[];
  emptyMessage?: string;
};

function comboOddsLabel(odds: number | null): string {
  if (odds == null) return "板なし";
  return formatWinOdds(odds);
}

function startMinutes(startTime: string): number {
  const m = startTime.match(/(\d{1,2}):(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 場ごとではなく発走時刻順（同時刻は場名 → R番）。 */
export function compareSanrenRaceOrder(
  a: { startTime: string; venue: string; raceNumber: number },
  b: { startTime: string; venue: string; raceNumber: number },
): number {
  const ta = startMinutes(a.startTime);
  const tb = startMinutes(b.startTime);
  if (ta !== tb) return ta - tb;
  if (a.venue !== b.venue) return a.venue.localeCompare(b.venue, "ja");
  return a.raceNumber - b.raceNumber;
}

function RacePickList({
  racePicks,
  race,
}: {
  racePicks: SanrenPick[];
  race: Race | undefined;
}) {
  const showOutcome = Boolean(race?.result?.finishes?.length);
  if (racePicks.length === 0) {
    return <p className="px-4 py-3 text-sm text-ink/45">候補なし</p>;
  }

  return (
    <ul className="space-y-3 px-4 pb-4 pt-1 md:px-5">
      {racePicks.map((pick) => {
        const ticket = ticketLabel(pick, race);
        const roles =
          pick.betType === "trifecta"
            ? (["1着", "2着", "3着"] as const)
            : (["軸", "相手", "穴"] as const);
        const nums = [
          pick.axisHorseNumber,
          pick.secondHorseNumber,
          pick.thirdHorseNumber,
        ].filter((n): n is number => n != null);

        return (
          <li
            key={`${pick.betType}-${pick.selection}`}
            className="border-t border-ink/8 pt-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="text-ink/60">
                    {BET_TYPE_LABELS[pick.betType]}
                  </span>
                  <span className="font-[family-name:var(--font-display)] font-semibold tabular-nums text-ink">
                    {pick.selection}
                  </span>
                  <span className={pick.odds == null ? "text-ink/40" : "font-medium text-signal"}>
                    {comboOddsLabel(pick.odds)}
                  </span>
                  <span
                    className={
                      pick.label === "研究所注目"
                        ? "font-medium text-signal"
                        : "text-ink/55"
                    }
                  >
                    {pick.label}
                  </span>
                  <span className="text-xs text-ink/45">
                    {PATTERN_LABELS[pick.pattern]}
                  </span>
                  {pick.hasSuperWatch ? (
                    <span className="align-middle">
                      <SuperWatchMark />
                    </span>
                  ) : null}
                  <span className={ticket.className}>{ticket.text}</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {nums.map((n, i) => (
                    <span key={`${pick.selection}-${n}-${i}`} className="inline-flex items-baseline gap-1">
                      <HorseChip
                        number={n}
                        race={race}
                        role={roles[i]}
                        showOutcome={showOutcome}
                      />
                      {i === 0 && pick.betType === "trifecta" ? (
                        <AxisMark rank={1} />
                      ) : null}
                    </span>
                  ))}
                </div>

                {pick.comment ? (
                  <p className="text-[13px] leading-snug text-ink/65">
                    {pick.comment}
                  </p>
                ) : null}
              </div>

              <div className="shrink-0 text-right">
                {pick.evScore != null ? (
                  <>
                    <p className="text-[10px] text-ink/45">EV</p>
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-turf">
                      {Math.round(pick.evScore)}
                    </p>
                    <p className="text-[10px] tabular-nums text-ink/45">
                      hit {Math.round(pick.hitScore ?? pick.relatedScore)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] text-ink/45">下限スコア</p>
                    <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-turf">
                      {Math.round(pick.relatedScore)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function racePeekLabel(racePicks: SanrenPick[], race: Race | undefined): string | null {
  if (racePicks.length === 0) return "候補なし";
  const watch = racePicks.filter((p) => p.label === "研究所注目").length;
  const hits = racePicks.filter((p) => ticketLabel(p, race).text.startsWith("的中")).length;
  const parts = [`${racePicks.length} 点`];
  if (watch > 0) parts.push(`注目 ${watch}`);
  if (hits > 0) parts.push(`的中 ${hits}`);
  return parts.join(" · ");
}

export function SanrenLabTable({
  picks,
  dayRaces,
  emptyMessage = "条件に合う候補がありません。",
}: Props) {
  const { races } = useRaceCatalog();
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const listRef = useRef<HTMLDivElement>(null);

  const byRace = useMemo(() => {
    const map = new Map<string, SanrenPick[]>();
    for (const p of picks) {
      const list = map.get(p.raceId) ?? [];
      list.push(p);
      map.set(p.raceId, list);
    }
    if (dayRaces?.length) {
      return [...dayRaces]
        .sort(compareSanrenRaceOrder)
        .map((race) => ({
          raceId: race.id,
          picks: map.get(race.id) ?? [],
          meta: {
            venue: race.venue,
            raceNumber: race.raceNumber,
            startTime: race.startTime,
            track: race.track,
            title: race.title,
          },
        }));
    }
    return [...map.entries()]
      .map(([raceId, racePicks]) => ({
        raceId,
        picks: racePicks,
        meta: racePicks[0],
      }))
      .sort((a, b) => compareSanrenRaceOrder(a.meta, b.meta));
  }, [picks, dayRaces]);

  function setAllOpen(open: boolean) {
    const root = listRef.current;
    if (!root) return;
    for (const el of root.querySelectorAll("details")) {
      el.open = open;
    }
  }

  if (dayRaces && dayRaces.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }
  if (!dayRaces && picks.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 text-sm">
        <button
          type="button"
          onClick={() => setAllOpen(true)}
          className="border border-ink/15 px-3 py-1.5 text-ink/70 transition hover:border-ink/40"
        >
          すべて開く
        </button>
        <button
          type="button"
          onClick={() => setAllOpen(false)}
          className="border border-ink/15 px-3 py-1.5 text-ink/70 transition hover:border-ink/40"
        >
          すべて閉じる
        </button>
      </div>

      <div ref={listRef} className="space-y-1.5">
        {byRace.map(({ raceId, picks: racePicks, meta }) => {
          const race = byId.get(raceId);
          const peek = racePeekLabel(racePicks, race);

          return (
            <details
              key={raceId}
              className="group border border-ink/10 bg-sand-dim/25 open:bg-sand-dim/40"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2.5 gap-y-1 px-4 py-2.5 md:px-5 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className="inline-block w-3 shrink-0 text-[11px] text-ink/40 transition group-open:rotate-90"
                >
                  ▸
                </span>
                <Link
                  href={`/races/${raceId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-turf hover:underline"
                >
                  {meta.venue} {meta.raceNumber}R
                </Link>
                <span className="text-xs tabular-nums text-ink/50">{meta.startTime}</span>
                <span className="text-xs text-ink/45">{meta.track}</span>
                <span
                  className={
                    racePicks.length === 0 ? "text-xs text-ink/40" : "text-xs text-ink/70"
                  }
                >
                  {peek}
                </span>
                <span className="ml-auto line-clamp-1 max-w-md text-xs text-ink/45">
                  {meta.title}
                </span>
              </summary>
              <RacePickList racePicks={racePicks} race={race} />
            </details>
          );
        })}
      </div>
    </div>
  );
}
