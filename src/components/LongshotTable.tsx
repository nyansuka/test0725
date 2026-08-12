"use client";

import { BET_TYPE_LABELS, parseSelectionNumbers } from "@/domain/betTypes";
import { groupLongshotPicks, type LongshotPickGroup } from "@/domain/longshots";
import type { LongshotPick, Race } from "@/domain/types";
import Link from "next/link";
import { LongshotMark, AxisMark, SuperWatchMark } from "@/components/LongshotMark";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import {
  formatPopularityParen,
  formatWinOdds,
  popularityByNumber,
} from "@/domain/odds";
import {
  evaluateHorse,
  evaluatePick,
  horseFinishRank,
  outcomeLabel,
} from "@/domain/results";
import { useMemo, type ReactNode } from "react";
import { selectAxisHorses } from "@/domain/axis";

function outcomeClass(outcome: ReturnType<typeof evaluateHorse>): string {
  if (outcome === "win") return "font-medium text-signal";
  if (outcome === "place") return "font-medium text-turf";
  if (outcome === "miss") return "text-ink/40";
  return "text-ink/55";
}

function HorseOutcomeBadge({
  horseNumber,
  race,
  show,
}: {
  horseNumber: number;
  race: Race | undefined;
  show: boolean;
}) {
  if (!show) return null;
  const outcome = evaluateHorse(horseNumber, race?.result);
  const rank = horseFinishRank(horseNumber, race?.result);
  const text =
    outcome === "pending"
      ? outcomeLabel(outcome)
      : rank != null
        ? `${rank}着 · ${outcomeLabel(outcome)}`
        : outcomeLabel(outcome);
  return <span className={`ml-2 text-sm ${outcomeClass(outcome)}`}>{text}</span>;
}

type Props = {
  picks: LongshotPick[];
  emptyMessage?: string;
  /** ホーム等向けの高密度表示 */
  compact?: boolean;
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

  if (pick.betType === "bracket_quinella" || pick.betType === "bracket_exacta") {
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
  compact = false,
}: {
  group: LongshotPickGroup;
  race: Race | undefined;
  compact?: boolean;
}) {
  const pop = race ? popularityByNumber(race.horses) : new Map<number, number>();
  const byNum = new Map((race?.horses ?? []).map((h) => [h.number, h]));
  const axisByNum = race
    ? new Map(selectAxisHorses(race).map((a) => [a.horseNumber, a]))
    : new Map<number, ReturnType<typeof selectAxisHorses>[number]>();
  const titleClass = compact
    ? "mt-0.5 font-[family-name:var(--font-display)] text-base font-semibold text-ink"
    : "mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-ink";
  const nameClass = compact ? "ml-1.5 text-sm font-medium" : "ml-2 text-lg font-medium";

  if (group.sameHorseAsSelection) {
    const n = group.relatedHorseNumbers[0];
    const horse = byNum.get(n);
    const rank = pop.get(n);
    const axis = axisByNum.get(n);
    return (
      <div className="min-w-0">
        {!compact ? (
          <p className="text-xs tracking-wider text-ink/45">注目馬 ＝ 推奨買い目</p>
        ) : null}
        <p className={titleClass}>
          <span className="tabular-nums">{n}</span>
          {horse ? <span className={nameClass}>{horse.name}</span> : null}
          {rank != null && (
            <span className="ml-1.5 text-xs font-medium text-ink/60 sm:text-sm">
              {formatPopularityParen(rank)}
            </span>
          )}
          {group.label === "注目穴" && (
            <span className="ml-1.5 align-middle text-sm">
              <LongshotMark />
            </span>
          )}
          {axis ? (
            <span className="ml-1 align-middle">
              <AxisMark rank={axis.rankInRace} />
            </span>
          ) : null}
          {group.hasSuperWatch ? (
            <span className="ml-1 align-middle">
              <SuperWatchMark />
            </span>
          ) : null}
          <HorseOutcomeBadge horseNumber={n} race={race} show={Boolean(race?.result)} />
        </p>
      </div>
    );
  }

  const horses = group.relatedHorseNumbers.map((n) => {
    const horse = byNum.get(n);
    const rank = pop.get(n);
    return { n, name: horse?.name, rank, axis: axisByNum.get(n) };
  });

  return (
    <div className="min-w-0">
      {!compact ? <p className="text-xs tracking-wider text-ink/45">関係馬</p> : null}
      <p
        className={
          compact
            ? "mt-0.5 font-[family-name:var(--font-display)] text-sm font-semibold text-ink"
            : "mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-ink"
        }
      >
        {horses.map((h, i) => (
          <span key={h.n}>
            {i > 0 ? <span className="mx-1 text-ink/30">·</span> : null}
            <span className="tabular-nums">{h.n}</span>
            {h.name ? (
              <span className={compact ? "ml-1 text-sm font-medium" : "ml-1.5 text-base font-medium"}>
                {h.name}
              </span>
            ) : null}
            {h.rank != null && (
              <span className="ml-1 text-xs font-medium text-ink/60">
                {formatPopularityParen(h.rank)}
              </span>
            )}
            {h.axis ? (
              <span className="ml-1 align-middle">
                <AxisMark rank={h.axis.rankInRace} />
              </span>
            ) : null}
            <HorseOutcomeBadge horseNumber={h.n} race={race} show={Boolean(race?.result)} />
          </span>
        ))}
        {group.label === "注目穴" && (
          <span className="ml-1.5 align-middle text-sm">
            <LongshotMark />
          </span>
        )}
        {group.hasSuperWatch ? (
          <span className="ml-1 align-middle">
            <SuperWatchMark />
          </span>
        ) : null}
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

export function LongshotTable({
  picks,
  emptyMessage = "条件に合う候補がありません。",
  compact = false,
}: Props) {
  const { races } = useRaceCatalog();
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const groups = useMemo(() => groupLongshotPicks(picks), [picks]);

  if (picks.length === 0) {
    return <p className={`text-center text-ink/60 ${compact ? "py-6 text-sm" : "py-10"}`}>{emptyMessage}</p>;
  }

  const showOutcome = picks.some((p) => byId.get(p.raceId)?.result);

  return (
    <div className={compact ? "space-y-2" : "space-y-4"}>
      {groups.map((group) => {
        const race = byId.get(group.raceId);
        const primaryComment =
          group.picks.find((p) => p.comment)?.comment ??
          group.picks[0]?.comment ??
          "";

        return (
          <article
            key={group.key}
            className={
              compact
                ? "border border-ink/10 bg-sand-dim/20 px-3 py-2.5"
                : "border border-ink/10 bg-sand-dim/25 px-4 py-4 md:px-5 md:py-5"
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                  <Link
                    href={`/races/${group.raceId}`}
                    className={`font-medium text-turf hover:underline ${compact ? "text-sm" : ""}`}
                  >
                    {group.venue} {group.raceNumber}R
                  </Link>
                  <span className="text-xs text-ink/50">{group.startTime}</span>
                  <span
                    className={
                      group.label === "注目穴"
                        ? "text-xs font-medium text-signal sm:text-sm"
                        : "text-xs text-ink/55 sm:text-sm"
                    }
                  >
                    {group.label}
                  </span>
                  {group.hasSuperWatch ? (
                    <span className="align-middle">
                      <SuperWatchMark />
                    </span>
                  ) : null}
                </div>
                <div className={compact ? "mt-1.5" : "mt-3"}>
                  <HorseHeadline group={group} race={race} compact={compact} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-ink/45 sm:text-xs">スコア</p>
                <p
                  className={`font-[family-name:var(--font-display)] font-semibold text-turf ${
                    compact ? "text-xl" : "text-2xl"
                  }`}
                >
                  {group.relatedPlacePotential}
                </p>
                {!compact ? (
                  <div className="mt-1 h-1.5 w-24 overflow-hidden bg-sand-dim">
                    <div
                      className="animate-bar h-full bg-turf"
                      style={{ width: `${group.relatedPlacePotential}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className={compact ? "mt-0.5" : "mt-1"}>
              {!group.sameHorseAsSelection && (
                <p className="text-[11px] tracking-wider text-ink/45">推奨買い目</p>
              )}
              {group.sameHorseAsSelection && group.picks.length > 0 && (
                <p className={`text-[11px] tracking-wider text-ink/45 ${compact ? "mt-1.5" : "mt-3"}`}>
                  券種・オッズ
                </p>
              )}
              <BetLines group={group} race={race} showOutcome={showOutcome} />
            </div>

            {primaryComment && !compact ? (
              <div className="mt-4 border-t border-ink/10 pt-3">
                <CommentBlock text={primaryComment} />
              </div>
            ) : null}
            {primaryComment && compact ? (
              <p className="mt-2 line-clamp-2 border-t border-ink/8 pt-2 text-[11px] leading-snug text-ink/60">
                {primaryComment}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
