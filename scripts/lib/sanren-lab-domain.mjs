/**
 * 3連系研究所セレクタ（scripts 用）。src/domain/sanrenLab.ts と挙動を揃える。
 */
import {
  HOT_SCORE_MAX,
  HOT_SCORE_MIN,
  popularityByNumber,
  scoreHorse,
  scoreWinPotential,
  selectAxisHorses,
} from "./loop-domain.mjs";
import {
  TRIO_WATCH_TOP_N,
  comboSortScore,
  trioEvScore,
  trioHitScore,
  trioHitScoreFavHoleHole,
} from "../../src/domain/sanrenTrioIndex.mjs";

export const DEFAULT_TRIFECTA_LANE = {
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

export const DEFAULT_TRIO_LANE = {
  betType: "trio",
  oddsThreshold: 100,
  oddsMax: null,
  scoreMin: 60,
  formMode: "formation",
  topNPerRace: 12,
  axisTopN: 3,
  popularRankMax: 5,
  holeRankMin: 6,
  partnerCap2: 2,
  partnerCapHole: 8,
  excludeDangerousFavs: true,
  preferExpectationRanks: ["S", "A"],
};

export const DEFAULT_SANREN_LAB = {
  trio: DEFAULT_TRIO_LANE,
  trifecta: DEFAULT_TRIFECTA_LANE,
};

const EXPERIMENT_DATES = new Set(["2026-09-12", "2026-09-13"]);
function isWeekendExperiment(raceDate) {
  return EXPERIMENT_DATES.has(raceDate);
}

export const SANREN_LANES = ["trio", "trifecta"];

function labelForLabScore(score) {
  if (score >= HOT_SCORE_MIN && score < HOT_SCORE_MAX) return "研究所注目";
  return "抑え";
}

function combinePlace(scores) {
  if (scores.length === 0) return 0;
  return Math.min(...scores);
}

function sortedSelection(nums) {
  return [...nums].sort((a, b) => a - b).join("-");
}

function boardOdds(race, betType, selection) {
  const entry = (race.oddsBoard ?? []).find(
    (e) => e.betType === betType && e.selection === selection,
  );
  return entry ? entry.odds : null;
}

function isDangerousFavorite(winPotential, popularity, winScores) {
  if (popularity > 2) return false;
  if (winScores.length === 0) return false;
  const sorted = [...winScores].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)] ?? 0;
  return winPotential < median;
}

function buildTrifectaComment(axis, second, third, relatedScore, axisWin, label) {
  return [
    `${label}: 1着固定 ${axis.number}（win${Math.round(axisWin)}）`,
    `→${second.number}-${third.number}`,
    `下限place=${Math.round(relatedScore)}`,
  ].join(" ");
}

function buildTrioComment(axis, partner, hole, axisPop, label, hitScore, evScore) {
  return [
    `${label}: 人気軸 ${axis.number}（${axisPop}人気）`,
    `×人気 ${partner.number} ×穴 ${hole.number}`,
    `hit=${Math.round(hitScore)} ev=${Math.round(evScore)}`,
  ].join(" ");
}

function buildTrioFavHoleHoleComment(axis, holeA, holeB, axisPop, label, hitScore, evScore) {
  return [
    `${label}: 人気軸 ${axis.number}（${axisPop}人気）`,
    `×穴 ${holeA.number} ×穴 ${holeB.number}`,
    `hit=${Math.round(hitScore)} ev=${Math.round(evScore)}`,
  ].join(" ");
}

function sortSanrenPicks(picks) {
  return [...picks].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    const ev = comboSortScore(b) - comboSortScore(a);
    if (ev !== 0) return ev;
    return (b.odds ?? 0) - (a.odds ?? 0);
  });
}

export function selectTrifectaLab(races, settings = DEFAULT_TRIFECTA_LANE) {
  if (settings.betType !== "trifecta") {
    throw new Error("selectTrifectaLab requires betType=trifecta");
  }
  if (settings.formMode !== "formation") return [];

  const partnerCap2 = settings.partnerCap2 ?? 3;
  const partnerCap3 = settings.partnerCap3 ?? 8;
  const axisTopN = settings.axisTopN ?? 3;
  const excludeDangerous = settings.excludeDangerousFavs !== false;
  const out = [];

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    if (!race.horses?.length) continue;

    const pops = popularityByNumber(race.horses);
    const placeByNum = new Map();
    const winByNum = new Map();
    for (const h of race.horses) {
      placeByNum.set(h.number, scoreHorse(h, race));
      winByNum.set(h.number, scoreWinPotential(h, race));
    }
    const winScores = [...winByNum.values()];

    const axisPool = selectAxisHorses(race).slice(0, axisTopN);
    const axisHorses = [];
    for (const ax of axisPool) {
      const horse = race.horses.find((h) => h.number === ax.horseNumber);
      if (!horse) continue;
      const win = winByNum.get(horse.number) ?? 0;
      const pop = pops.get(horse.number) ?? 99;
      if (excludeDangerous && isDangerousFavorite(win, pop, winScores)) continue;
      axisHorses.push(horse);
    }
    if (axisHorses.length === 0) continue;

    const byPlaceDesc = [...race.horses].sort((a, b) => {
      const d = (placeByNum.get(b.number) ?? 0) - (placeByNum.get(a.number) ?? 0);
      if (d !== 0) return d;
      return a.oddsWin - b.oddsWin;
    });

    const racePicks = [];
    const seen = new Set();

    for (const axis of axisHorses) {
      const col2 = byPlaceDesc
        .filter((h) => h.number !== axis.number)
        .slice(0, partnerCap2);
      const col2Nums = new Set(col2.map((h) => h.number));
      const col3 = byPlaceDesc
        .filter((h) => h.number !== axis.number && !col2Nums.has(h.number))
        .slice(0, partnerCap3);
      if (col2.length === 0 || col3.length === 0) continue;

      const pairs = [];
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
    const kept = racePicks.slice(0, settings.topNPerRace);
    out.push(...kept);

    if (isWeekendExperiment(race.raceDate)) {
      const winAxisNums = new Set(axisHorses.map((h) => h.number));
      const popAxes = [...race.horses]
        .map((h) => ({
          horse: h,
          pop: pops.get(h.number) ?? 99,
          place: placeByNum.get(h.number) ?? 0,
          win: winByNum.get(h.number) ?? 0,
        }))
        .filter((s) => {
          if (s.pop < 1 || s.pop > 5) return false;
          if (winAxisNums.has(s.horse.number)) return false;
          if (excludeDangerous && isDangerousFavorite(s.win, s.pop, winScores)) return false;
          return true;
        })
        .sort((a, b) => b.place - a.place || b.win - a.win || a.pop - b.pop)
        .slice(0, axisTopN)
        .map((s) => s.horse);

      for (const axis of popAxes) {
        const col2 = byPlaceDesc.filter((h) => h.number !== axis.number).slice(0, partnerCap2);
        const col2Nums = new Set(col2.map((h) => h.number));
        const col3 = byPlaceDesc
          .filter((h) => h.number !== axis.number && !col2Nums.has(h.number))
          .slice(0, partnerCap3);
        if (col2.length === 0 || col3.length === 0) continue;
        const pairs = [];
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
          out.push({
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
            relatedHorseNumbers: [axis.number, second.number, third.number],
            pattern: "ordered_axis",
            relatedScore,
            axisWinPotential: axisWin,
            label: "検討",
            hasSuperWatch: false,
            comment: buildTrifectaComment(axis, second, third, relatedScore, axisWin, "検討"),
          });
        }
      }
    }
  }

  return sortSanrenPicks(out);
}

export function selectTrioLab(races, settings = DEFAULT_TRIO_LANE) {
  if (settings.betType !== "trio") {
    throw new Error("selectTrioLab requires betType=trio");
  }
  if (settings.formMode !== "formation") return [];

  const popularRankMax = settings.popularRankMax ?? 5;
  const holeRankMin = settings.holeRankMin ?? 6;
  const axisTopN = settings.axisTopN ?? 3;
  const partnerCapPopular = settings.partnerCap2 ?? 2;
  const partnerCapHole = settings.partnerCapHole ?? 8;
  const excludeDangerous = settings.excludeDangerousFavs !== false;
  const out = [];

  for (const race of races) {
    if (race.authority !== "JRA") continue;
    if (!race.horses?.length) continue;

    const pops = popularityByNumber(race.horses);
    const placeByNum = new Map();
    const winByNum = new Map();
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

    const racePicks = [];
    const seen = new Set();

    const pushPick = (nums, axis, second, third, pattern, hitScore) => {
      const selection = sortedSelection(nums);
      if (seen.has(selection)) return;
      seen.add(selection);

      const odds = boardOdds(race, "trio", selection);
      if (odds != null) {
        if (odds < settings.oddsThreshold) return;
        if (settings.oddsMax != null && odds > settings.oddsMax) return;
      }

      const floorPlace = combinePlace([axis.place, second.place, third.place]);
      if (floorPlace < settings.scoreMin) return;

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
        secondHorseNumber: second.horse.number,
        thirdHorseNumber: third.horse.number,
        relatedHorseNumbers: sortedNums,
        pattern,
        relatedScore: hitScore,
        hitScore,
        evScore,
        axisWinPotential: axis.win,
        label: "抑え",
        comment: "",
      });
    };

    for (const axis of axisList) {
      const partners = popularPool
        .filter((s) => s.horse.number !== axis.horse.number)
        .slice(0, partnerCapPopular);
      if (partners.length === 0) continue;

      for (const partner of partners) {
        for (const hole of holePool) {
          if (hole.horse.number === axis.horse.number) continue;
          if (hole.horse.number === partner.horse.number) continue;

          const hitScore = trioHitScore({
            favPopA: axis.pop,
            favPopB: partner.pop,
            holePop: hole.pop,
            holePlace: hole.place,
            racePlaces,
          });
          pushPick(
            [axis.horse.number, partner.horse.number, hole.horse.number],
            axis,
            partner,
            hole,
            "fav_fav_hole",
            hitScore,
          );
        }
      }
    }

    if (holePool.length >= 2) {
      for (const axis of axisList) {
        for (let i = 0; i < holePool.length; i += 1) {
          for (let j = i + 1; j < holePool.length; j += 1) {
            const holeA = holePool[i];
            const holeB = holePool[j];
            if (holeA.horse.number === axis.horse.number) continue;
            if (holeB.horse.number === axis.horse.number) continue;

            const hitScore = trioHitScoreFavHoleHole({
              favPop: axis.pop,
              holePopA: holeA.pop,
              holePopB: holeB.pop,
              holePlaceA: holeA.place,
              holePlaceB: holeB.place,
              racePlaces,
            });
            pushPick(
              [axis.horse.number, holeA.horse.number, holeB.horse.number],
              axis,
              holeA,
              holeB,
              "fav_hole_hole",
              hitScore,
            );
          }
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
      const label = i < TRIO_WATCH_TOP_N ? "研究所注目" : "抑え";
      pick.label = label;
      const axisH = race.horses.find((h) => h.number === pick.axisHorseNumber);
      const partnerH = race.horses.find((h) => h.number === pick.secondHorseNumber);
      const holeH = race.horses.find((h) => h.number === pick.thirdHorseNumber);
      if (axisH && partnerH && holeH) {
        pick.comment =
          pick.pattern === "fav_hole_hole"
            ? buildTrioFavHoleHoleComment(
                axisH,
                partnerH,
                holeH,
                pops.get(axisH.number) ?? 99,
                label,
                pick.hitScore ?? pick.relatedScore,
                pick.evScore ?? pick.relatedScore,
              )
            : buildTrioComment(
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

    if (isWeekendExperiment(race.raceDate)) {
      const keptKeys = new Set(kept.map((p) => p.selection));
      for (const axis of axisList) {
        const extraPartners = popularPool
          .filter((s) => s.horse.number !== axis.horse.number)
          .slice(partnerCapPopular, 3);
        for (const partner of extraPartners) {
          for (const hole of holePool) {
            if (hole.horse.number === axis.horse.number) continue;
            if (hole.horse.number === partner.horse.number) continue;
            const hitScore = trioHitScore({
              favPopA: axis.pop,
              favPopB: partner.pop,
              holePop: hole.pop,
              holePlace: hole.place,
              racePlaces,
            });
            const nums = [axis.horse.number, partner.horse.number, hole.horse.number];
            const selection = sortedSelection(nums);
            if (keptKeys.has(selection) || seen.has(selection)) continue;
            seen.add(selection);
            const odds = boardOdds(race, "trio", selection);
            if (odds != null) {
              if (odds < settings.oddsThreshold) continue;
              if (settings.oddsMax != null && odds > settings.oddsMax) continue;
            }
            const floorPlace = combinePlace([axis.place, partner.place, hole.place]);
            if (floorPlace < settings.scoreMin) continue;
            const evScore = trioEvScore(hitScore, odds);
            out.push({
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
              relatedHorseNumbers: [...nums].sort((a, b) => a - b),
              pattern: "fav_fav_hole",
              relatedScore: hitScore,
              hitScore,
              evScore,
              axisWinPotential: axis.win,
              label: "検討",
              comment: buildTrioComment(
                axis.horse,
                partner.horse,
                hole.horse,
                pops.get(axis.horse.number) ?? 99,
                "検討",
                hitScore,
                evScore,
              ),
            });
          }
        }
      }
    }
  }

  return sortSanrenPicks(out);
}

export function selectSanrenLane(lane, races, settings) {
  if (lane === "trio") {
    return selectTrioLab(races, settings ?? DEFAULT_TRIO_LANE);
  }
  if (lane === "trifecta") {
    return selectTrifectaLab(races, settings ?? DEFAULT_TRIFECTA_LANE);
  }
  throw new Error(`Unknown sanren lane: ${lane}`);
}

export function defaultLaneSettings(lane) {
  if (lane === "trio") return { ...DEFAULT_TRIO_LANE };
  if (lane === "trifecta") return { ...DEFAULT_TRIFECTA_LANE };
  throw new Error(`Unknown sanren lane: ${lane}`);
}

export function summarizeSanrenLabDensity(picks) {
  const map = new Map();
  const patternCounts = {};
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
