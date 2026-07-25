import type { BetType, LongshotLabel, LongshotPick, OddsEntry, Race, UserSelectionSettings } from "./types";
import { parseSelectionNumbers } from "./betTypes";
import { getScorer } from "./scoring";

/** 注目穴 / 抑え候補の境界（scoreMin とは独立） */
export const LABEL_SCORE_THRESHOLD = 70;

export type OddsBoardStatus =
  | "candidate" // ゲート＋スコア通過 → 注目穴ボード掲載
  | "pass" // オッズゲート通過だがスコア不足 → 見送り
  | "below_threshold" // オッズが閾値未満
  | "disabled_bet" // 券種OFF
  | "no_related"; // 関係馬が解決できない

export type OddsBoardRow = {
  entry: OddsEntry;
  status: OddsBoardStatus;
  relatedHorseNumbers: number[];
  relatedPlacePotential: number;
  label?: LongshotLabel;
  comment?: string;
};

function resolveRelatedHorses(race: Race, selection: string, betType: BetType) {
  const nums = parseSelectionNumbers(selection);
  if (betType === "bracket_quinella") {
    return race.horses.filter((h) => h.bracket != null && nums.includes(h.bracket));
  }
  return race.horses.filter((h) => nums.includes(h.number));
}

function combinePlacePotential(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.min(...scores);
}

/** 埋め込み値に依存せず、常に現行 Scorer で算出（出走表と候補の一致を保証） */
export function scoreHorse(horse: Race["horses"][number], race: Race): number {
  return getScorer().score(horse, race).placePotential;
}

function pickComment(race: Race, related: Race["horses"]): string {
  if (related.length === 0) return "関係馬の評価が不足しています。";
  const best = [...related].sort((a, b) => scoreHorse(b, race) - scoreHorse(a, race))[0];
  return best.comment;
}

function labelFor(score: number): LongshotLabel {
  return score >= LABEL_SCORE_THRESHOLD ? "注目穴" : "抑え候補";
}

export function classifyOddsEntry(
  race: Race,
  entry: OddsEntry,
  settings: UserSelectionSettings,
): OddsBoardRow {
  const enabled = new Set(settings.enabledBetTypes);
  if (!enabled.has(entry.betType)) {
    return {
      entry,
      status: "disabled_bet",
      relatedHorseNumbers: [],
      relatedPlacePotential: 0,
    };
  }
  if (entry.odds < settings.oddsThreshold) {
    return {
      entry,
      status: "below_threshold",
      relatedHorseNumbers: [],
      relatedPlacePotential: 0,
    };
  }

  const related = resolveRelatedHorses(race, entry.selection, entry.betType);
  if (related.length === 0) {
    return {
      entry,
      status: "no_related",
      relatedHorseNumbers: [],
      relatedPlacePotential: 0,
    };
  }

  const relatedPlacePotential = combinePlacePotential(related.map((h) => scoreHorse(h, race)));
  if (relatedPlacePotential < settings.scoreMin) {
    return {
      entry,
      status: "pass",
      relatedHorseNumbers: related.map((h) => h.number),
      relatedPlacePotential,
      comment: pickComment(race, related),
    };
  }

  return {
    entry,
    status: "candidate",
    relatedHorseNumbers: related.map((h) => h.number),
    relatedPlacePotential,
    label: labelFor(relatedPlacePotential),
    comment: pickComment(race, related),
  };
}

export function selectLongshots(
  races: Race[],
  settings: UserSelectionSettings,
): LongshotPick[] {
  const picks: LongshotPick[] = [];

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    for (const entry of race.oddsBoard) {
      const row = classifyOddsEntry(race, entry, settings);
      if (row.status !== "candidate" || !row.label) continue;
      picks.push({
        raceId: race.id,
        venue: race.venue,
        raceNumber: race.raceNumber,
        startTime: race.startTime,
        track: race.track,
        title: race.title,
        betType: entry.betType,
        selection: entry.selection,
        odds: entry.odds,
        relatedHorseNumbers: row.relatedHorseNumbers,
        relatedPlacePotential: row.relatedPlacePotential,
        label: row.label,
        comment: row.comment ?? "",
      });
    }
  }

  return picks.sort((a, b) => b.relatedPlacePotential - a.relatedPlacePotential);
}

/**
 * レース期待度（Sが最上）。
 * edge = topスコア*0.7 + 高スコア候補数*8 + 候補件数*3（上限100）
 * S: edge≥85 かつ スコア≥70 の候補が2件以上
 * A: ≥70 / B: ≥55 / C: ≥40 / D: それ未満 or 候補なし
 */
export function raceExpectationRank(picksForRace: LongshotPick[]) {
  if (picksForRace.length === 0) return "D" as const;
  const top = Math.max(...picksForRace.map((p) => p.relatedPlacePotential));
  const highCount = picksForRace.filter((p) => p.relatedPlacePotential >= LABEL_SCORE_THRESHOLD).length;
  const edge = Math.min(
    100,
    top * 0.7 + Math.min(highCount, 4) * 8 + Math.min(picksForRace.length, 6) * 3,
  );

  if (edge >= 85 && highCount >= 2) return "S" as const;
  if (edge >= 70) return "A" as const;
  if (edge >= 55) return "B" as const;
  if (edge >= 40) return "C" as const;
  return "D" as const;
}

export function enrichHorseScores(race: Race) {
  const scorer = getScorer();
  return race.horses.map((horse) => {
    const result = scorer.score(horse, race);
    return {
      ...horse,
      placePotential: result.placePotential,
      factors: result.factors,
      rationale: result.rationale,
    };
  });
}

export const EXPECTATION_RANK_HELP =
  "候補の質と量から算出。S: 高スコア候補が複数 / A〜C: 期待の強さ / D: 候補なしまたは薄い";
