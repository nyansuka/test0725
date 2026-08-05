import type { AxisHorsePick, Horse, LongshotPick, Race } from "./types";
import { getScorer } from "./scoring";
import { popularityByNumber } from "./odds";
import {
  midLongshotComposite,
  MID_COMPOSITE_MIN,
  MID_REPLACE_GAP,
  isRaceTopTime,
} from "./scoring/popularityPrior";

/** レースあたりの軸馬上限（PLAN §5.5） */
export const AXIS_TOP_N = 3;

export function scoreWinPotential(horse: Race["horses"][number], race: Race): number {
  return getScorer().score(horse, race).winPotential;
}

/** 注目穴の関係馬番（レース指定可） */
export function longshotWatchNumbers(
  picks: LongshotPick[],
  raceId?: string,
): Set<number> {
  const set = new Set<number>();
  for (const pick of picks) {
    if (pick.label !== "注目穴") continue;
    if (raceId && pick.raceId !== raceId) continue;
    for (const n of pick.relatedHorseNumbers) set.add(n);
  }
  return set;
}

function qualifiesMidLongshot(
  horse: Horse,
  popularity: number,
  field: Horse[],
): boolean {
  if (popularity < 6 || popularity > 10) return false;
  const fs = horse.formStats;
  const comp = midLongshotComposite(horse);
  // 前走勝ちは無条件で候補
  if (fs?.lastRank === 1) return true;
  // 前走複勝圏＋最低限の適性
  if (fs?.lastRank != null && fs.lastRank <= 3 && comp >= 58) return true;
  // 同条件ベストタイムがレース内上位20%（好タイム）
  if (isRaceTopTime(horse, field)) return true;
  // formStats が薄いときは適性合成のみ（下限）
  return comp >= MID_COMPOSITE_MIN;
}

type Scored = {
  horse: Horse;
  winPotential: number;
  popularity: number;
  midComposite: number;
  promoted?: boolean;
};

/**
 * レース内 winPotential Top3（単勝オッズ上限なし）。
 * 同点時は単勝オッズ昇順（人気寄り）。
 * Top3 に中穴が居ないとき、条件を満たす最良の 6〜10人気で 3枠目を差し替えうる。
 */
export function selectAxisHorses(
  race: Race,
  longshotPicks?: LongshotPick[],
): AxisHorsePick[] {
  if (race.authority !== "JRA" || race.horses.length === 0) return [];

  const pops = popularityByNumber(race.horses);
  const scored: Scored[] = race.horses.map((horse) => ({
    horse,
    winPotential: scoreWinPotential(horse, race),
    popularity: pops.get(horse.number) ?? 99,
    midComposite: midLongshotComposite(horse),
  }));

  scored.sort((a, b) => {
    if (b.winPotential !== a.winPotential) return b.winPotential - a.winPotential;
    return a.horse.oddsWin - b.horse.oddsWin;
  });

  const axis = scored.slice(0, Math.min(AXIS_TOP_N, scored.length));
  const hasMid = axis.some((a) => a.popularity >= 6 && a.popularity <= 10);

  if (!hasMid && axis.length === AXIS_TOP_N) {
    const candidates = scored
      .filter((a) => qualifiesMidLongshot(a.horse, a.popularity, race.horses))
      .sort((a, b) => {
        if (b.midComposite !== a.midComposite) return b.midComposite - a.midComposite;
        return b.winPotential - a.winPotential;
      });
    const cand = candidates[0];
    const third = axis[2];
    if (cand && third && cand.winPotential + MID_REPLACE_GAP >= third.winPotential) {
      // 既に Top3 に居ないこと
      if (!axis.some((a) => a.horse.number === cand.horse.number)) {
        axis[2] = { ...cand, promoted: true };
      }
    }
  }

  const watch = longshotPicks
    ? longshotWatchNumbers(longshotPicks, race.id)
    : new Set<number>();

  return axis.map((item, index) => ({
    raceId: race.id,
    horseNumber: item.horse.number,
    winPotential: item.winPotential,
    rankInRace: (index + 1) as 1 | 2 | 3,
    isSuperWatch: watch.has(item.horse.number),
    midPromoted: Boolean(item.promoted),
  }));
}

export function selectAxisHorsesForRaces(
  races: Race[],
  longshotPicks?: LongshotPick[],
): AxisHorsePick[] {
  const out: AxisHorsePick[] = [];
  for (const race of races) {
    out.push(...selectAxisHorses(race, longshotPicks));
  }
  return out;
}

/** 軸馬番 → rank / 超注目 */
export function axisIndexByNumber(axis: AxisHorsePick[]): Map<
  number,
  {
    rankInRace: 1 | 2 | 3;
    winPotential: number;
    isSuperWatch: boolean;
    midPromoted?: boolean;
  }
> {
  const map = new Map<
    number,
    {
      rankInRace: 1 | 2 | 3;
      winPotential: number;
      isSuperWatch: boolean;
      midPromoted?: boolean;
    }
  >();
  for (const a of axis) {
    map.set(a.horseNumber, {
      rankInRace: a.rankInRace,
      winPotential: a.winPotential,
      isSuperWatch: a.isSuperWatch,
      midPromoted: a.midPromoted,
    });
  }
  return map;
}
