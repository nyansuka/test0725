import type {
  Horse,
  Race,
  SanrenLabLabel,
  SanrenLaneSettings,
  SanrenLabSettings,
  SanrenPick,
} from "./types";
import { HOT_SCORE_MAX, HOT_SCORE_MIN, scoreHorse } from "./longshots";
import { scoreWinPotential, selectAxisHorses } from "./axis";
import { popularityByNumber } from "./odds";
import {
  TRIO_WATCH_TOP_N,
  comboSortScore,
  trioEvScore,
  trioHitScore,
} from "./sanrenTrioIndex.mjs";

/** TRIFECTA-LAB §3.2 仮初期値 */
export const DEFAULT_TRIFECTA_LANE: SanrenLaneSettings = {
  betType: "trifecta",
  oddsThreshold: 200,
  oddsMax: null,
  scoreMin: 60,
  formMode: "formation",
  topNPerRace: 80,
  partnerCap2: 3,
  partnerCap3: 8,
  axisTopN: 3,
  excludeDangerousFavs: true,
  preferExpectationRanks: ["S", "A"],
};

/** TRIFECTA-LAB §3.3 仮初期値 */
export const DEFAULT_TRIO_LANE: SanrenLaneSettings = {
  betType: "trio",
  oddsThreshold: 100,
  oddsMax: null,
  scoreMin: 60,
  formMode: "formation",
  topNPerRace: 12,
  axisTopN: 3,
  popularRankMax: 5,
  holeRankMin: 6,
  /** 人気帯の相手（軸以外）上限 */
  partnerCap2: 2,
  partnerCapHole: 8,
  excludeDangerousFavs: true,
  preferExpectationRanks: ["S", "A"],
};

export const DEFAULT_SANREN_LAB: SanrenLabSettings = {
  trio: DEFAULT_TRIO_LANE,
  trifecta: DEFAULT_TRIFECTA_LANE,
};

function labelForLabScore(score: number): SanrenLabLabel {
  if (score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX) return "研究所注目";
  return "抑え";
}

function combinePlace(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.min(...scores);
}

function sortedSelection(nums: number[]): string {
  return [...nums].sort((a, b) => a - b).join("-");
}

function boardOdds(
  race: Race,
  betType: "trio" | "trifecta",
  selection: string,
): number | null {
  const entry = race.oddsBoard.find(
    (e) => e.betType === betType && e.selection === selection,
  );
  return entry ? entry.odds : null;
}

/**
 * 危険人気（仮）:
 * 1〜2人気かつ winPotential がレース中央値未満。
 */
function isDangerousFavorite(
  winPotential: number,
  popularity: number,
  winScores: number[],
): boolean {
  if (popularity > 2) return false;
  if (winScores.length === 0) return false;
  const sorted = [...winScores].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  return winPotential < median;
}

function buildTrifectaComment(
  axis: Horse,
  second: Horse,
  third: Horse,
  relatedScore: number,
  axisWin: number,
  label: SanrenLabLabel,
): string {
  return [
    `${label}: 1着固定 ${axis.number}（win${Math.round(axisWin)}）`,
    `→${second.number}-${third.number}`,
    `下限place=${Math.round(relatedScore)}`,
  ].join(" ");
}

function buildTrioComment(
  axis: Horse,
  partner: Horse,
  hole: Horse,
  axisPop: number,
  label: SanrenLabLabel,
  hitScore: number,
  evScore: number,
): string {
  return [
    `${label}: 人気軸 ${axis.number}（${axisPop}人気）`,
    `×人気 ${partner.number} ×穴 ${hole.number}`,
    `hit=${Math.round(hitScore)} ev=${Math.round(evScore)}`,
  ].join(" ");
}

/**
 * 3連単研究所: 1着固定フォーメーション（2/3列裏返し）の制限付き候補生成。
 * TRIFECTA-LAB §8.2 / S2a。
 */
export function selectTrifectaLab(
  races: Race[],
  settings: SanrenLaneSettings = DEFAULT_TRIFECTA_LANE,
): SanrenPick[] {
  if (settings.betType !== "trifecta") {
    throw new Error("selectTrifectaLab requires betType=trifecta");
  }
  if (settings.formMode !== "formation") {
    return [];
  }

  const partnerCap2 = settings.partnerCap2 ?? 3;
  const partnerCap3 = settings.partnerCap3 ?? 8;
  const axisTopN = settings.axisTopN ?? 3;
  const excludeDangerous = settings.excludeDangerousFavs !== false;

  const out: SanrenPick[] = [];

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    if (!race.horses?.length) continue;

    const pops = popularityByNumber(race.horses);
    const placeByNum = new Map<number, number>();
    const winByNum = new Map<number, number>();
    for (const h of race.horses) {
      placeByNum.set(h.number, scoreHorse(h, race));
      winByNum.set(h.number, scoreWinPotential(h, race));
    }
    const winScores = [...winByNum.values()];

    const axisPool = selectAxisHorses(race).slice(0, axisTopN);
    const axisHorses: Horse[] = [];
    for (const ax of axisPool) {
      const horse = race.horses.find((h) => h.number === ax.horseNumber);
      if (!horse) continue;
      const win = winByNum.get(horse.number) ?? 0;
      const pop = pops.get(horse.number) ?? 99;
      if (excludeDangerous && isDangerousFavorite(win, pop, winScores)) {
        continue;
      }
      axisHorses.push(horse);
    }
    if (axisHorses.length === 0) continue;

    const byPlaceDesc = [...race.horses].sort((a, b) => {
      const d = (placeByNum.get(b.number) ?? 0) - (placeByNum.get(a.number) ?? 0);
      if (d !== 0) return d;
      return a.oddsWin - b.oddsWin;
    });

    const racePicks: SanrenPick[] = [];
    const seen = new Set<string>();

    for (const axis of axisHorses) {
      const col2 = byPlaceDesc
        .filter((h) => h.number !== axis.number)
        .slice(0, partnerCap2);

      const col2Nums = new Set(col2.map((h) => h.number));
      const col3 = byPlaceDesc
        .filter((h) => h.number !== axis.number && !col2Nums.has(h.number))
        .slice(0, partnerCap3);

      if (col2.length === 0 || col3.length === 0) continue;

      const pairs: Array<[Horse, Horse]> = [];
      for (const a of col2) {
        for (const b of col3) {
          pairs.push([a, b]);
          pairs.push([b, a]);
        }
      }

      const axisWin = winByNum.get(axis.number) ?? 0;
      const axisPlace = placeByNum.get(axis.number) ?? 0;

      for (const [second, third] of pairs) {
        const selection = `${axis.number}-${second.number}-${third.number}`;
        if (seen.has(selection)) continue;
        seen.add(selection);

        const odds = boardOdds(race, "trifecta", selection);
        if (odds == null) continue;
        if (odds < settings.oddsThreshold) continue;
        if (settings.oddsMax != null && odds > settings.oddsMax) continue;

        const relatedScore = combinePlace([
          axisPlace,
          placeByNum.get(second.number) ?? 0,
          placeByNum.get(third.number) ?? 0,
        ]);
        if (relatedScore < settings.scoreMin) continue;

        const label = labelForLabScore(relatedScore);
        const relatedHorseNumbers = [axis.number, second.number, third.number];
        const axisPick = axisPool.find((a) => a.horseNumber === axis.number);

        racePicks.push({
          raceId: race.id,
          venue: race.venue,
          raceNumber: race.raceNumber,
          startTime: race.startTime,
          track: race.track,
          title: race.title,
          betType: "trifecta",
          selection,
          odds,
          axisHorseNumber: axis.number,
          secondHorseNumber: second.number,
          thirdHorseNumber: third.number,
          relatedHorseNumbers,
          pattern: "ordered_axis",
          relatedScore,
          axisWinPotential: axisWin,
          label,
          hasSuperWatch: axisPick?.isSuperWatch === true,
          comment: buildTrifectaComment(
            axis,
            second,
            third,
            relatedScore,
            axisWin,
            label,
          ),
        });
      }
    }

    racePicks.sort((a, b) => {
      if (b.relatedScore !== a.relatedScore) return b.relatedScore - a.relatedScore;
      if (a.label !== b.label) return a.label === "研究所注目" ? -1 : 1;
      return b.odds - a.odds;
    });

    out.push(...racePicks.slice(0, settings.topNPerRace));
  }

  return sortSanrenPicks(out);
}

/**
 * 3連複研究所: 人気軸 × 人気相手 × 穴（順不同・fav_fav_hole）。
 * TRIFECTA-LAB §8.3 / S2b。
 */
export function selectTrioLab(
  races: Race[],
  settings: SanrenLaneSettings = DEFAULT_TRIO_LANE,
): SanrenPick[] {
  if (settings.betType !== "trio") {
    throw new Error("selectTrioLab requires betType=trio");
  }
  if (settings.formMode !== "formation") {
    return [];
  }

  const popularRankMax = settings.popularRankMax ?? 5;
  const holeRankMin = settings.holeRankMin ?? 6;
  const axisTopN = settings.axisTopN ?? 3;
  const partnerCapPopular = settings.partnerCap2 ?? 2;
  const partnerCapHole = settings.partnerCapHole ?? 8;
  const excludeDangerous = settings.excludeDangerousFavs !== false;

  const out: SanrenPick[] = [];

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    if (!race.horses?.length) continue;

    const pops = popularityByNumber(race.horses);
    const placeByNum = new Map<number, number>();
    const winByNum = new Map<number, number>();
    for (const h of race.horses) {
      placeByNum.set(h.number, scoreHorse(h, race));
      winByNum.set(h.number, scoreWinPotential(h, race));
    }
    const winScores = [...winByNum.values()];
    const racePlaces = [...placeByNum.values()];

    const scored = race.horses.map((h) => {
      const pop = pops.get(h.number) ?? 99;
      const place = placeByNum.get(h.number) ?? 0;
      const win = winByNum.get(h.number) ?? 0;
      const dangerous =
        excludeDangerous && isDangerousFavorite(win, pop, winScores);
      return { horse: h, pop, place, win, dangerous };
    });

    const popularPool = scored
      .filter((s) => s.pop >= 1 && s.pop <= popularRankMax && !s.dangerous)
      .sort((a, b) => {
        const d = b.place - a.place || b.win - a.win;
        if (d !== 0) return d;
        return a.pop - b.pop;
      });

    const holePool = scored
      .filter((s) => s.pop >= holeRankMin)
      .sort((a, b) => {
        const d = b.place - a.place;
        if (d !== 0) return d;
        return b.pop - a.pop;
      })
      .slice(0, partnerCapHole);

    const axisList = popularPool.slice(0, axisTopN);
    if (axisList.length === 0 || holePool.length === 0) continue;

    const racePicks: SanrenPick[] = [];
    const seen = new Set<string>();

    for (const axis of axisList) {
      const partners = popularPool
        .filter((s) => s.horse.number !== axis.horse.number)
        .slice(0, partnerCapPopular);
      if (partners.length === 0) continue;

      for (const partner of partners) {
        for (const hole of holePool) {
          if (hole.horse.number === axis.horse.number) continue;
          if (hole.horse.number === partner.horse.number) continue;

          const nums = [
            axis.horse.number,
            partner.horse.number,
            hole.horse.number,
          ];
          const selection = sortedSelection(nums);
          if (seen.has(selection)) continue;
          seen.add(selection);

          const odds = boardOdds(race, "trio", selection);
          if (odds != null) {
            if (odds < settings.oddsThreshold) continue;
            if (settings.oddsMax != null && odds > settings.oddsMax) continue;
          }

          const floorPlace = combinePlace([
            axis.place,
            partner.place,
            hole.place,
          ]);
          if (floorPlace < settings.scoreMin) continue;

          const hitScore = trioHitScore({
            favPopA: axis.pop,
            favPopB: partner.pop,
            holePop: hole.pop,
            holePlace: hole.place,
            racePlaces,
          });
          const evScore = trioEvScore(hitScore, odds);
          const sortedNums = [...nums].sort((a, b) => a - b);

          racePicks.push({
            raceId: race.id,
            venue: race.venue,
            raceNumber: race.raceNumber,
            startTime: race.startTime,
            track: race.track,
            title: race.title,
            betType: "trio",
            selection,
            odds,
            axisHorseNumber: axis.horse.number,
            secondHorseNumber: partner.horse.number,
            thirdHorseNumber: hole.horse.number,
            relatedHorseNumbers: sortedNums,
            pattern: "fav_fav_hole",
            relatedScore: hitScore,
            hitScore,
            evScore,
            axisWinPotential: axis.win,
            label: "抑え",
            comment: "",
          });
        }
      }
    }

    racePicks.sort((a, b) => {
      const ev = comboSortScore(b) - comboSortScore(a);
      if (ev !== 0) return ev;
      return (b.odds ?? 0) - (a.odds ?? 0);
    });

    const kept = racePicks.slice(0, settings.topNPerRace);
    for (let i = 0; i < kept.length; i += 1) {
      const pick = kept[i];
      const label: SanrenLabLabel =
        i < TRIO_WATCH_TOP_N ? "研究所注目" : "抑え";
      pick.label = label;
      const axisH = race.horses.find((h) => h.number === pick.axisHorseNumber);
      const partnerH = race.horses.find((h) => h.number === pick.secondHorseNumber);
      const holeH = race.horses.find((h) => h.number === pick.thirdHorseNumber);
      if (axisH && partnerH && holeH) {
        pick.comment = buildTrioComment(
          axisH,
          partnerH,
          holeH,
          pops.get(axisH.number) ?? 99,
          label,
          pick.hitScore ?? pick.relatedScore,
          pick.evScore ?? pick.relatedScore,
        );
      }
    }

    out.push(...kept);
  }

  return sortSanrenPicks(out);
}

/** 混在表示用ラッパ（KPI 集計には使わない） */
export function selectSanrenLab(
  races: Race[],
  settings: SanrenLabSettings = DEFAULT_SANREN_LAB,
): { trio: SanrenPick[]; trifecta: SanrenPick[] } {
  return {
    trio: selectTrioLab(races, settings.trio),
    trifecta: selectTrifectaLab(races, settings.trifecta),
  };
}

function sortSanrenPicks(picks: SanrenPick[]): SanrenPick[] {
  return [...picks].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    const ev = comboSortScore(b) - comboSortScore(a);
    if (ev !== 0) return ev;
    return (b.odds ?? 0) - (a.odds ?? 0);
  });
}

/** レースあたりの候補数サマリ（検証用） */
export function summarizeSanrenLabDensity(picks: SanrenPick[]): {
  raceCount: number;
  pickCount: number;
  perRace: { raceId: string; n: number }[];
  avgPerRace: number;
  minPerRace: number;
  maxPerRace: number;
  patternCounts: Record<string, number>;
} {
  const map = new Map<string, number>();
  const patternCounts: Record<string, number> = {};
  for (const p of picks) {
    map.set(p.raceId, (map.get(p.raceId) ?? 0) + 1);
    patternCounts[p.pattern] = (patternCounts[p.pattern] ?? 0) + 1;
  }
  const perRace = [...map.entries()].map(([raceId, n]) => ({ raceId, n }));
  const ns = perRace.map((r) => r.n);
  const raceCount = ns.length;
  const pickCount = picks.length;
  return {
    raceCount,
    pickCount,
    perRace,
    avgPerRace: raceCount ? pickCount / raceCount : 0,
    minPerRace: ns.length ? Math.min(...ns) : 0,
    maxPerRace: ns.length ? Math.max(...ns) : 0,
    patternCounts,
  };
}

/** @deprecated 互換。{@link summarizeSanrenLabDensity} を使う */
export function summarizeTrifectaLabDensity(picks: SanrenPick[]) {
  const s = summarizeSanrenLabDensity(picks);
  return {
    raceCount: s.raceCount,
    pickCount: s.pickCount,
    perRace: s.perRace,
    avgPerRace: s.avgPerRace,
    minPerRace: s.minPerRace,
    maxPerRace: s.maxPerRace,
  };
}
