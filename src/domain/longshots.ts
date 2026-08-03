import type { BetType, LongshotLabel, LongshotPick, OddsEntry, Race, UserSelectionSettings } from "./types";
import { parseSelectionNumbers } from "./betTypes";
import { getScorer } from "./scoring";
import { buildPickComment } from "./comment";
import { getTrendIndex } from "./trendData";
import { selectAxisHorses } from "./axis";

/** 注目穴 / 抑え候補の境界（scoreMin とは独立） */
export const LABEL_SCORE_THRESHOLD = 70;

export type OddsBoardStatus =
  | "candidate" // ゲート＋スコア通過 → 注目穴ボード掲載
  | "pass" // オッズゲート通過だがスコア不足 → 見送り
  | "below_threshold" // オッズが閾値未満
  | "above_max" // オッズが上限超過
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

function pickComment(
  race: Race,
  related: Race["horses"],
  entry: OddsEntry,
  label: LongshotLabel,
): string {
  return buildPickComment(
    race,
    related,
    {
      betType: entry.betType,
      venue: race.venue,
      track: race.track,
      odds: entry.odds,
      label,
      excludeRaceDate: race.raceDate,
    },
    getTrendIndex(),
  );
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
  if (settings.oddsMax != null && entry.odds > settings.oddsMax) {
    return {
      entry,
      status: "above_max",
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
    const label = labelFor(relatedPlacePotential);
    return {
      entry,
      status: "pass",
      relatedHorseNumbers: related.map((h) => h.number),
      relatedPlacePotential,
      comment: pickComment(race, related, entry, label),
    };
  }

  const label = labelFor(relatedPlacePotential);
  return {
    entry,
    status: "candidate",
    relatedHorseNumbers: related.map((h) => h.number),
    relatedPlacePotential,
    label,
    comment: pickComment(race, related, entry, label),
  };
}

export function selectLongshots(
  races: Race[],
  settings: UserSelectionSettings,
): LongshotPick[] {
  const picks: LongshotPick[] = [];
  const axisNumsByRace = new Map<string, Set<number>>();

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    axisNumsByRace.set(
      race.id,
      new Set(selectAxisHorses(race).map((a) => a.horseNumber)),
    );
    for (const entry of race.oddsBoard) {
      const row = classifyOddsEntry(race, entry, settings);
      if (row.status !== "candidate" || !row.label) continue;
      const axisNums = axisNumsByRace.get(race.id) ?? new Set();
      const hasSuperWatch =
        row.label === "注目穴" &&
        row.relatedHorseNumbers.some((n) => axisNums.has(n));
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
        hasSuperWatch,
      });
    }
  }

  return picks.sort((a, b) => {
    if (Boolean(b.hasSuperWatch) !== Boolean(a.hasSuperWatch)) {
      return a.hasSuperWatch ? -1 : 1;
    }
    return b.relatedPlacePotential - a.relatedPlacePotential;
  });
}

/** 関係馬集合が同じ候補を1枠にまとめるキー（並びは呼び出し側の順を維持） */
export function longshotGroupKey(pick: LongshotPick): string {
  const nums = [...pick.relatedHorseNumbers].sort((a, b) => a - b);
  if (nums.length > 0) return `${pick.raceId}::${nums.join("-")}`;
  return `${pick.raceId}::${pick.betType}:${pick.selection}`;
}

export type LongshotPickGroup = {
  key: string;
  raceId: string;
  venue: string;
  raceNumber: number;
  startTime: string;
  track: "芝" | "ダート";
  title: string;
  relatedHorseNumbers: number[];
  relatedPlacePotential: number;
  /** 枠内の最上位ラベル（注目穴優先） */
  label: LongshotLabel;
  picks: LongshotPick[];
  /**
   * 関係馬が1頭だけで、各買い目もその馬単体（単勝・複勝など）のとき true。
   * 注目馬と推奨買い目が同じ馬なので、馬情報と買い目を1枠にまとめて重複表示しない。
   */
  sameHorseAsSelection: boolean;
  /** 枠内に超注目を含む買い目がある */
  hasSuperWatch: boolean;
};

/** 並び順を保ったまま、関係馬が同じ候補をグループ化 */
export function groupLongshotPicks(picks: LongshotPick[]): LongshotPickGroup[] {
  const order: string[] = [];
  const map = new Map<string, LongshotPick[]>();

  for (const pick of picks) {
    const key = longshotGroupKey(pick);
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(pick);
  }

  return order.map((key) => {
    const groupPicks = map.get(key)!;
    const head = groupPicks[0];
    const relatedHorseNumbers = [...head.relatedHorseNumbers].sort((a, b) => a - b);
    const sameHorseAsSelection =
      relatedHorseNumbers.length === 1 &&
      groupPicks.every((p) => {
        if (p.relatedHorseNumbers.length !== 1) return false;
        if (p.relatedHorseNumbers[0] !== relatedHorseNumbers[0]) return false;
        return p.selection.trim() === String(relatedHorseNumbers[0]);
      });
    const label = groupPicks.some((p) => p.label === "注目穴") ? "注目穴" : head.label;
    const relatedPlacePotential = Math.max(
      ...groupPicks.map((p) => p.relatedPlacePotential),
    );
    const hasSuperWatch = groupPicks.some((p) => p.hasSuperWatch);

    return {
      key,
      raceId: head.raceId,
      venue: head.venue,
      raceNumber: head.raceNumber,
      startTime: head.startTime,
      track: head.track,
      title: head.title,
      relatedHorseNumbers,
      relatedPlacePotential,
      label,
      picks: groupPicks,
      sameHorseAsSelection,
      hasSuperWatch,
    };
  });
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
      winPotential: result.winPotential,
      factors: result.factors,
      rationale: result.rationale,
    };
  });
}

export const EXPECTATION_RANK_HELP =
  "候補の質と量から算出。S: 高スコア候補が複数 / A〜C: 期待の強さ / D: 候補なしまたは薄い";
