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
  oddsThreshold: 25,
  /** B3: 上限80（感度スイープ推奨。null で上限なし） */
  oddsMax: 80,
  scoreMin: 75,
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
  if (settings.oddsMax != null && entry.odds > settings.oddsMax) {
    return { status: "above_max", relatedHorseNumbers: [], relatedPlacePotential: 0 };
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

function relatedNumbers(pick) {
  if (pick.relatedHorseNumbers?.length) return pick.relatedHorseNumbers;
  return parseSelectionNumbers(pick.selection);
}

/** 関係馬のうち最良着順（未着・欠場のみなら null） */
export function bestRelatedRank(pick, result) {
  if (!result?.finishes?.length) return null;
  let best = null;
  for (const n of relatedNumbers(pick)) {
    const finish = result.finishes.find((f) => f.number === n);
    if (finish?.rank == null || finish.rank < 1) continue;
    if (best == null || finish.rank < best) best = finish.rank;
  }
  return best;
}

export function isInMoney(outcome) {
  return outcome === "win" || outcome === "place";
}

export function outcomeLabel(outcome) {
  switch (outcome) {
    case "win":
      return "大当たり";
    case "place":
      return "馬券内";
    case "miss":
      return "はずれ";
    default:
      return "待ち";
  }
}

/**
 * 複勝圏ベース判定（券種の厳密払戻とは別）
 * @returns {"win"|"place"|"miss"|"pending"}
 * - win … 1着（大当たり）
 * - place … 2・3着（馬券内）
 * - miss … 4着以下（はずれ）
 */
export function evaluatePick(pick, result) {
  if (!result?.finishes?.length) return "pending";
  const rank = bestRelatedRank(pick, result);
  if (rank == null) return "miss";
  if (rank === 1) return "win";
  if (rank <= 3) return "place";
  return "miss";
}

function normKey(betType, selection) {
  const nums = parseSelectionNumbers(selection);
  // 順不同券種は昇順で突合（オッズ板と払戻の並び差を吸収）
  const unordered = new Set(["quinella", "wide", "bracket_quinella", "trio"]);
  const legs = unordered.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return `${betType}:${legs.join("-")}`;
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
