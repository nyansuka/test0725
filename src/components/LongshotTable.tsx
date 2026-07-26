"use client";

import { BET_TYPE_LABELS, parseSelectionNumbers } from "@/domain/betTypes";
import { groupLongshotPicks, type LongshotPickGroup } from "@/domain/longshots";
import type { LongshotPick, Race } from "@/domain/types";
import Link from "next/link";
import { LongshotMark } from "@/components/LongshotMark";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import {
  formatPopularityParen,
  formatWinOdds,
  popularityByNumber,
} from "@/domain/odds";
import { evaluatePick, outcomeLabel } from "@/domain/results";
import { useMemo, type ReactNode } from "react";

type Props = {
  picks: LongshotPick[];
  emptyMessage?: string;
};

function CommentBlock({ text }: { text: string }) {
  const parts = text.split(" ／ ").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return <p className="leading-relaxed text-ink/70">{text}</p>;
  }
  return (
    <div className="space-y-1.5 text-[13px] leading-snug">
      {parts.map((part) => {
        const isTrend = part.startsWith("傾向:");
        const isEval = part.startsWith("評価:");
        return (
          <p
            key={part}
            className={
              isTrend
                ? "font-medium text-turf"
                : isEval
                  ? "text-ink/80"
                  : "text-ink/65"
            }
          >
            {part}
          </p>
        );
      })}
    </div>
  );
}

function SelectionLabel({ pick, race }: { pick: LongshotPick; race: Race | undefined }) {
  const pop = race ? popularityByNumber(race.horses) : new Map<number, number>();

  if (!race) {
    return <>{pick.selection}</>;
  }

  if (pick.betType === "bracket_quinella") {
    const ranks = [...new Set(
      pick.relatedHorseNumbers
        .map((n) => pop.get(n))
        .filter((r): r is number => r != null),
    )].sort((a, b) => a - b);
    return (
      <>
        {pick.selection}{" "}
        {ranks.map((r) => (
          <span key={r} className="ml-1 text-sm font-medium text-ink/65">
            {formatPopularityParen(r)}
          </span>
        ))}
      </>
    );
  }

  const parts = pick.selection.split(/[-–—/]/);
  const nums = parseSelectionNumbers(pick.selection);
  return (
    <>
      {parts.map((part, i) => {
        const n = nums[i];
        const rank = n != null ? pop.get(n) : undefined;
        return (
          <span key={`${part}-${i}`}>
            {i > 0 ? "-" : null}
            {part.trim()}
            {rank != null && (
              <span className="ml-1 text-sm font-medium text-ink/65">
                {formatPopularityParen(rank)}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}

function HorseHeadline({
  group,
  race,
}: {
  group: LongshotPickGroup;
  race: Race | undefined;
}) {
  const pop = race ? popularityByNumber(race.horses) : new Map<number, number>();
  const byNum = new Map((race?.horses ?? []).map((h) => [h.number, h]));

  if (group.sameHorseAsSelection) {
    const n = group.relatedHorseNumbers[0];
    const horse = byNum.get(n);
    const rank = pop.get(n);
    return (
      <div className="min-w-0">
        <p className="text-xs tracking-wider text-ink/45">注目馬 ＝ 推奨買い目</p>
        <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-ink">
          <span className="tabular-nums">{n}</span>
          {horse ? (
            <span className="ml-2 text-lg font-medium">{horse.name}</span>
          ) : null}
          {rank != null && (
            <span className="ml-2 text-sm font-medium text-ink/60">
              {formatPopularityParen(rank)}
            </span>
          )}
          {group.label === "注目穴" && (
            <span className="ml-2 align-middle text-base">
              <LongshotMark />
            </span>
          )}
        </p>
      </div>
    );
  }

  const horses = group.relatedHorseNumbers.map((n) => {
    const horse = byNum.get(n);
    const rank = pop.get(n);
    return { n, name: horse?.name, rank };
  });

  return (
    <div className="min-w-0">
      <p className="text-xs tracking-wider text-ink/45">関係馬</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink">
        {horses.map((h, i) => (
          <span key={h.n}>
            {i > 0 ? <span className="mx-1.5 text-ink/30">·</span> : null}
            <span className="tabular-nums">{h.n}</span>
            {h.name ? <span className="ml-1.5 text-base font-medium">{h.name}</span> : null}
            {h.rank != null && (
              <span className="ml-1 text-sm font-medium text-ink/60">
                {formatPopularityParen(h.rank)}
              </span>
            )}
          </span>
        ))}
        {group.label === "注目穴" && (
          <span className="ml-2 align-middle text-base">
            <LongshotMark />
          </span>
        )}
      </p>
    </div>
  );
}

function BetLines({
  group,
  race,
  showOutcome,
}: {
  group: LongshotPickGroup;
  race: Race | undefined;
  showOutcome: boolean;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {group.picks.map((pick) => {
        const outcome = evaluatePick(pick, race?.result);
        let selection: ReactNode;
        if (group.sameHorseAsSelection) {
          // 馬番は見出し側に出したので券種＋オッズのみ
          selection = null;
        } else {
          selection = (
            <span className="font-[family-name:var(--font-display)] font-semibold text-ink">
              <SelectionLabel pick={pick} race={race} />
            </span>
          );
        }
        return (
          <li
            key={`${pick.betType}-${pick.selection}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm"
          >
            <span className="min-w-[3.5rem] text-ink/70">{BET_TYPE_LABELS[pick.betType]}</span>
            {selection}
            <span className="font-medium text-signal">{formatWinOdds(pick.odds)}</span>
            {pick.label !== group.label && (
              <span
                className={
                  pick.label === "注目穴" ? "font-medium text-signal" : "text-ink/55"
                }
              >
                {pick.label}
              </span>
            )}
            {showOutcome && (
              <span
                className={
                  outcome === "win"
                    ? "font-medium text-signal"
                    : outcome === "place"
                      ? "font-medium text-turf"
                      : outcome === "miss"
                        ? "text-ink/40"
                        : "text-ink/55"
                }
              >
                {outcomeLabel(outcome)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function LongshotTable({ picks, emptyMessage = "条件に合う候補がありません。" }: Props) {
  const { races } = useRaceCatalog();
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const groups = useMemo(() => groupLongshotPicks(picks), [picks]);

  if (picks.length === 0) {
    return <p className="py-10 text-center text-ink/60">{emptyMessage}</p>;
  }

  const showOutcome = picks.some((p) => byId.get(p.raceId)?.result);

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const race = byId.get(group.raceId);
        const primaryComment =
          group.picks.find((p) => p.comment)?.comment ??
          group.picks[0]?.comment ??
          "";

        return (
          <article
            key={group.key}
            className="border border-ink/10 bg-sand-dim/25 px-4 py-4 md:px-5 md:py-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/races/${group.raceId}`}
                    className="font-medium text-turf hover:underline"
                  >
                    {group.venue} {group.raceNumber}R
                  </Link>
                  <span className="text-xs text-ink/50">{group.startTime}</span>
                  <span
                    className={
                      group.label === "注目穴"
                        ? "text-sm font-medium text-signal"
                        : "text-sm text-ink/55"
                    }
                  >
                    {group.label}
                  </span>
                </div>
                <div className="mt-3">
                  <HorseHeadline group={group} race={race} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-ink/45">スコア</p>
                <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-turf">
                  {group.relatedPlacePotential}
                </p>
                <div className="mt-1 h-1.5 w-24 overflow-hidden bg-sand-dim">
                  <div
                    className="animate-bar h-full bg-turf"
                    style={{ width: `${group.relatedPlacePotential}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="mt-1">
              {!group.sameHorseAsSelection && (
                <p className="text-xs tracking-wider text-ink/45">推奨買い目</p>
              )}
              {group.sameHorseAsSelection && group.picks.length > 0 && (
                <p className="mt-3 text-xs tracking-wider text-ink/45">券種・オッズ</p>
              )}
              <BetLines group={group} race={race} showOutcome={showOutcome} />
            </div>

            {primaryComment && (
              <div className="mt-4 border-t border-ink/10 pt-3">
                <CommentBlock text={primaryComment} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
