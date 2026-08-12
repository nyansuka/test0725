import type { BetType, LongshotLabel, LongshotPick, OddsEntry, Race, UserSelectionSettings } from "./types";
import { parseSelectionNumbers } from "./betTypes";
import { getScorer } from "./scoring";
import { buildPickComment } from "./comment";
import { getTrendIndex } from "./trendData";
import { selectAxisHorses } from "./axis";

/** 注目穴スコア帯（C3: ticket 最適。下限含む・上限含まず） */
export const HOT_SCORE_MIN = 65;
export const HOT_SCORE_MAX = 70;

/**
 * @deprecated 互換用。注目穴判定は {@link labelForScore} / HOT_SCORE_* を使う。
 * 期待度の highCount も HOT 帯を数える。
 */
export const LABEL_SCORE_THRESHOLD = HOT_SCORE_MIN;

export function labelForScore(score: number): LongshotLabel {
  if (score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX) return "注目穴";
  return "抑え候補";
}

function isHotScore(score: number): boolean {
  return score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX;
}

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
  if (betType === "bracket_quinella" || betType === "bracket_exacta") {
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
  return labelForScore(score);
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
 * レース期待度（Sが最上）。2026-08-06 再キャリブ。
 *
 * edge（件数ペナルティ）:
 *   top*0.75 + min(highCount,3)*10 - max(0, pickCount-3)*4
 * 開催日内で候補ありレースを edge 降順にし、相対で S〜C を割当（D=候補なし）。
 * 単レース呼び出し時は同じ edge の絶対閾値フォールバック。
 */
export function expectationEdge(picksForRace: LongshotPick[]): {
  top: number;
  highCount: number;
  pickCount: number;
  edge: number;
} {
  if (picksForRace.length === 0) {
    return { top: 0, highCount: 0, pickCount: 0, edge: 0 };
  }
  const top = Math.max(...picksForRace.map((p) => p.relatedPlacePotential));
  const highCount = picksForRace.filter((p) => isHotScore(p.relatedPlacePotential)).length;
  const pickCount = picksForRace.length;
  const edge = Math.max(
    0,
    top * 0.75 + Math.min(highCount, 3) * 10 - Math.max(0, pickCount - 3) * 4,
  );
  return { top, highCount, pickCount, edge };
}

/** 単レース用絶対閾値（日内ピアが無いとき） */
function rankFromEdgeAbsolute(meta: ReturnType<typeof expectationEdge>) {
  if (meta.pickCount === 0) return "D" as const;
  const { edge, highCount, pickCount, top } = meta;
  if (edge >= 84 && highCount >= 2 && pickCount <= 6 && top >= 78) return "S" as const;
  if (edge >= 70) return "A" as const;
  if (edge >= 55) return "B" as const;
  if (edge >= 40) return "C" as const;
  return "D" as const;
}

/**
 * 開催日単位で期待度を割当。候補ありを edge 降順:
 * 上位≈12%→S / 累積≈32%→A / 累積≈57%→B / 残り候補あり→C / なし→D
 */
export function assignDayExpectationRanks(
  races: { raceId: string; picks: LongshotPick[] }[],
): Map<string, "S" | "A" | "B" | "C" | "D"> {
  const metas = races.map((r) => ({
    raceId: r.raceId,
    picks: r.picks,
    ...expectationEdge(r.picks),
  }));
  const ranks = new Map<string, "S" | "A" | "B" | "C" | "D">();
  for (const m of metas) ranks.set(m.raceId, "D");

  const withPicks = metas
    .filter((m) => m.pickCount > 0)
    .sort((a, b) => b.edge - a.edge || b.top - a.top || a.raceId.localeCompare(b.raceId));
  const m = withPicks.length;
  if (m === 0) return ranks;

  const sCut = Math.max(1, Math.ceil(m * 0.12));
  const aCut = Math.max(sCut + 1, Math.ceil(m * 0.32));
  const bCut = Math.max(aCut + 1, Math.ceil(m * 0.57));

  withPicks.forEach((row, i) => {
    let rank: "S" | "A" | "B" | "C" | "D" = "C";
    if (i < sCut && row.highCount >= 1) rank = "S";
    else if (i < aCut) rank = "A";
    else if (i < bCut) rank = "B";
    ranks.set(row.raceId, rank);
  });
  return ranks;
}

export function raceExpectationRank(picksForRace: LongshotPick[]) {
  return rankFromEdgeAbsolute(expectationEdge(picksForRace));
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
  "開催日内の候補ありレースを相対評価。S: 上位約12%（高スコア候補あり）/ A〜C: 続く帯 / D: 候補なし。件数が多いだけで上がらない";
