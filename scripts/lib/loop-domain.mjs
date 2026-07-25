/**
 * 改善ループ用の選別・的中判定（ドメイン層の薄い移植）。
 * src/domain の TypeScript と挙動を揃えること。
 */

export const ALL_BET_TYPES = [
  "win",
  "place",
  "bracket_quinella",
  "quinella",
  "wide",
  "exacta",
  "trio",
  "trifecta",
];

export const DEFAULT_SETTINGS = {
  oddsThreshold: 20,
  scoreMin: 60,
  enabledBetTypes: [...ALL_BET_TYPES],
};

export const LABEL_SCORE_THRESHOLD = 70;

const WEIGHTS = {
  courseFit: 0.25,
  paceFit: 0.2,
  conditionFit: 0.15,
  formSignal: 0.2,
  valueGap: 0.1,
  gateJockey: 0.1,
};

export function parseSelectionNumbers(selection) {
  return String(selection)
    .split(/[-–—/]/)
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function clamp(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function scoreHorse(horse, race) {
  const factors = { ...horse.factors };
  if (factors.gateJockey == null) {
    factors.gateJockey = horse.bracket != null && horse.bracket <= 3 ? 62 : 52;
  }
  if (String(race.condition).includes("稍") || String(race.condition).includes("重")) {
    factors.conditionFit = clamp(factors.conditionFit + (factors.conditionFit >= 65 ? 4 : -2));
  }
  if (horse.oddsWin >= 12) {
    factors.valueGap = clamp(factors.valueGap + 3);
  }
  return clamp(
    factors.courseFit * WEIGHTS.courseFit +
      factors.paceFit * WEIGHTS.paceFit +
      factors.conditionFit * WEIGHTS.conditionFit +
      factors.formSignal * WEIGHTS.formSignal +
      factors.valueGap * WEIGHTS.valueGap +
      (factors.gateJockey ?? 50) * WEIGHTS.gateJockey,
  );
}

function resolveRelatedHorses(race, selection, betType) {
  const nums = parseSelectionNumbers(selection);
  if (betType === "bracket_quinella") {
    return race.horses.filter((h) => h.bracket != null && nums.includes(h.bracket));
  }
  return race.horses.filter((h) => nums.includes(h.number));
}

function combinePlacePotential(scores) {
  if (scores.length === 0) return 0;
  return Math.min(...scores);
}

function pickComment(race, related) {
  if (related.length === 0) return "関係馬の評価が不足しています。";
  const best = [...related].sort((a, b) => scoreHorse(b, race) - scoreHorse(a, race))[0];
  return best.comment ?? "";
}

function labelFor(score) {
  return score >= LABEL_SCORE_THRESHOLD ? "注目穴" : "抑え候補";
}

export function classifyOddsEntry(race, entry, settings) {
  const enabled = new Set(settings.enabledBetTypes);
  if (!enabled.has(entry.betType)) {
    return { status: "disabled_bet", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  if (entry.odds < settings.oddsThreshold) {
    return { status: "below_threshold", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  const related = resolveRelatedHorses(race, entry.selection, entry.betType);
  if (related.length === 0) {
    return { status: "no_related", relatedHorseNumbers: [], relatedPlacePotential: 0 };
  }
  const relatedPlacePotential = combinePlacePotential(related.map((h) => scoreHorse(h, race)));
  if (relatedPlacePotential < settings.scoreMin) {
    return {
      status: "pass",
      relatedHorseNumbers: related.map((h) => h.number),
      relatedPlacePotential,
      comment: pickComment(race, related),
    };
  }
  return {
    status: "candidate",
    relatedHorseNumbers: related.map((h) => h.number),
    relatedPlacePotential,
    label: labelFor(relatedPlacePotential),
    comment: pickComment(race, related),
  };
}

export function selectLongshots(races, settings) {
  const picks = [];
  for (const race of races) {
    if (race.authority !== "JRA") continue;
    for (const entry of race.oddsBoard ?? []) {
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

function topN(result, n) {
  return result.finishes
    .filter((f) => f.rank != null && f.rank >= 1 && f.rank <= n)
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
    .map((f) => f.number);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

/** @returns {"hit"|"miss"|"pending"} */
export function evaluatePick(pick, result) {
  if (!result?.finishes?.length) return "pending";
  const nums = parseSelectionNumbers(pick.selection);
  const first = topN(result, 1);
  const top2 = topN(result, 2);
  const top3 = topN(result, 3);

  switch (pick.betType) {
    case "win":
      return nums[0] != null && first[0] === nums[0] ? "hit" : "miss";
    case "place":
      return nums[0] != null && top3.includes(nums[0]) ? "hit" : "miss";
    case "quinella":
      return nums.length >= 2 && sameSet(nums.slice(0, 2), top2) ? "hit" : "miss";
    case "wide":
      return nums.length >= 2 && nums.slice(0, 2).every((n) => top3.includes(n)) ? "hit" : "miss";
    case "bracket_quinella": {
      const related = pick.relatedHorseNumbers ?? [];
      return related.filter((n) => top2.includes(n)).length >= 2 ? "hit" : "miss";
    }
    case "exacta":
      return nums.length >= 2 && nums[0] === top2[0] && nums[1] === top2[1] ? "hit" : "miss";
    case "trio":
      return nums.length >= 3 && sameSet(nums.slice(0, 3), top3) ? "hit" : "miss";
    case "trifecta":
      return nums.length >= 3 &&
        nums[0] === top3[0] &&
        nums[1] === top3[1] &&
        nums[2] === top3[2]
        ? "hit"
        : "miss";
    default:
      return "pending";
  }
}

function normKey(betType, selection) {
  const nums = parseSelectionNumbers(selection);
  return `${betType}:${nums.join("-")}`;
}

export function findPayoutYen(result, betType, selection) {
  if (!result?.payouts?.length) return null;
  const key = normKey(betType, selection);
  const hit = result.payouts.find((p) => normKey(p.betType, p.selection) === key);
  return hit ? hit.payoutYen : null;
}

export function pickKey(pick) {
  return `${pick.raceId}|${pick.betType}|${parseSelectionNumbers(pick.selection).join("-")}`;
}
