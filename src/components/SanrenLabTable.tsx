"use client";

import Link from "next/link";
import { useMemo } from "react";
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
  emptyMessage?: string;
};

export function SanrenLabTable({
  picks,
  emptyMessage = "条件に合う候補がありません。",
}: Props) {
  const { races } = useRaceCatalog();
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);

  const byRace = useMemo(() => {
    const map = new Map<string, SanrenPick[]>();
    for (const p of picks) {
      const list = map.get(p.raceId) ?? [];
      list.push(p);
      map.set(p.raceId, list);
    }
    return [...map.entries()].map(([raceId, racePicks]) => ({
      raceId,
      picks: racePicks,
      meta: racePicks[0],
    }));
  }, [picks]);

  if (picks.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-5">
      {byRace.map(({ raceId, picks: racePicks, meta }) => {
        const race = byId.get(raceId);
        const showOutcome = Boolean(race?.result?.finishes?.length);

        return (
          <section
            key={raceId}
            className="border border-ink/10 bg-sand-dim/25 px-4 py-4 md:px-5 md:py-5"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <Link
                  href={`/races/${raceId}`}
                  className="font-medium text-turf hover:underline"
                >
                  {meta.venue} {meta.raceNumber}R
                </Link>
                <span className="text-xs text-ink/50">{meta.startTime}</span>
                <span className="text-xs text-ink/45">{meta.track}</span>
                <span className="text-xs text-ink/55">{racePicks.length} 点</span>
              </div>
              <p className="text-xs text-ink/45 line-clamp-1 max-w-md">{meta.title}</p>
            </header>

            <ul className="mt-4 space-y-3">
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
                    className="border-t border-ink/8 pt-3 first:border-t-0 first:pt-0"
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
                          <span className="font-medium text-signal">
                            {formatWinOdds(pick.odds)}
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
                        <p className="text-[10px] text-ink/45">下限スコア</p>
                        <p className="font-[family-name:var(--font-display)] text-xl font-semibold text-turf">
                          {Math.round(pick.relatedScore)}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
