/**
 * 3連系研究所 M1/M2: 的中ファネルと Miss 分解。
 * レーン合算しない。オッズ閾値は設定どおり（ここでは変えない）。
 *
 * ファネル（入れ子）:
 *   payouts → onBoard → gated → generated → scorePass → topN → watch
 *
 * Miss（未捕捉の払戻・排他）:
 *   板なし / ゲート落ち / 未生成 / scoreMin落ち / topN落ち
 * ゲート落ちは 未生成 を汚さないための5つ目。M2 の4種に加えて数える。
 */
import { parseSelectionNumbers } from "./loop-domain.mjs";
import { selectSanrenLane } from "./sanren-lab-domain.mjs";

export const SANREN_WATCH_LABEL = "研究所注目";
export const OPEN_TOP_N = 10_000;

export const MISS_KINDS = [
  "板なし",
  "ゲート落ち",
  "未生成",
  "scoreMin落ち",
  "topN落ち",
];

export function comboKey(raceId, betType, selection) {
  const nums = parseSelectionNumbers(selection);
  const legs = betType === "trio" ? [...nums].sort((a, b) => a - b) : nums;
  return `${raceId}|${betType}|${legs.join("-")}`;
}

export function emptyFunnel() {
  return {
    payouts: 0,
    onBoard: 0,
    gated: 0,
    generated: 0,
    scorePass: 0,
    topN: 0,
    watch: 0,
  };
}

export function emptyMissCounts() {
  return {
    板なし: 0,
    ゲート落ち: 0,
    未生成: 0,
    scoreMin落ち: 0,
    topN落ち: 0,
  };
}

export function funnelRates(funnel) {
  const f = funnel ?? emptyFunnel();
  const ratio = (num, den) => (den > 0 ? num / den : null);
  return {
    boardRate: ratio(f.onBoard, f.payouts),
    gateRate: ratio(f.gated, f.onBoard),
    generatedRate: ratio(f.generated, f.gated),
    scorePassRate: ratio(f.scorePass, f.generated),
    topNRate: ratio(f.topN, f.scorePass),
    watchRate: ratio(f.watch, f.topN),
    catchRate: ratio(f.topN, f.gated),
  };
}

export function mergeFunnel(a, b) {
  const left = a ?? emptyFunnel();
  const right = b ?? emptyFunnel();
  return {
    payouts: left.payouts + right.payouts,
    onBoard: left.onBoard + right.onBoard,
    gated: left.gated + right.gated,
    generated: left.generated + right.generated,
    scorePass: left.scorePass + right.scorePass,
    topN: left.topN + right.topN,
    watch: left.watch + right.watch,
  };
}

export function mergeMissCounts(a, b) {
  const left = a ?? emptyMissCounts();
  const right = b ?? emptyMissCounts();
  const out = emptyMissCounts();
  for (const k of MISS_KINDS) {
    out[k] = (left[k] ?? 0) + (right[k] ?? 0);
  }
  return out;
}

export function inOddsGate(odds, settings) {
  if (odds == null || !Number.isFinite(odds)) return false;
  if (odds < settings.oddsThreshold) return false;
  if (settings.oddsMax != null && odds > settings.oddsMax) return false;
  return true;
}

export function classifySanrenMiss({
  onBoard,
  gated,
  inGenerated,
  inScorePass,
  inTopN,
}) {
  if (!onBoard) return "板なし";
  if (!gated) return "ゲート落ち";
  if (inTopN) return null;
  if (!inGenerated) return "未生成";
  if (!inScorePass) return "scoreMin落ち";
  return "topN落ち";
}

function pickIndex(picks, betType) {
  const map = new Map();
  for (const p of picks ?? []) {
    map.set(comboKey(p.raceId, betType, p.selection), p);
  }
  return map;
}

function frozenBoardEntry(frozenRace, betType, selection) {
  const want = comboKey(frozenRace.id, betType, selection);
  for (const e of frozenRace.oddsBoard ?? []) {
    if (e.betType !== betType) continue;
    if (comboKey(frozenRace.id, betType, e.selection) === want) return e;
  }
  return null;
}

function openSettings(settings, scoreMin) {
  return {
    ...settings,
    scoreMin,
    topNPerRace: OPEN_TOP_N,
  };
}

/**
 * @param {object} input
 * @param {"trio"|"trifecta"} input.lane
 * @param {object} input.settings
 * @param {object[]} input.frozenRaces 凍結オッズ（結果なし想定）
 * @param {object[]} input.liveRaces 払戻付きライブ
 * @param {object[]} input.productionPicks 当日の研究所候補（topN 後）
 * @param {object[]} [input.generatedPicks] テスト用上書き（scoreMin=0・topN開放）
 * @param {object[]} [input.scorePassPicks] テスト用上書き（scoreMin維持・topN開放）
 */
export function analyzeSanrenHitFunnel({
  lane,
  settings,
  frozenRaces,
  liveRaces,
  productionPicks,
  generatedPicks,
  scorePassPicks,
}) {
  const betType = settings?.betType ?? lane;
  const liveById = new Map((liveRaces ?? []).map((r) => [r.id, r]));
  const generated =
    generatedPicks ??
    selectSanrenLane(lane, frozenRaces ?? [], openSettings(settings, 0));
  const scorePass =
    scorePassPicks ??
    selectSanrenLane(
      lane,
      frozenRaces ?? [],
      openSettings(settings, settings.scoreMin),
    );

  const produced = pickIndex(productionPicks, betType);
  const generatedIdx = pickIndex(generated, betType);
  const scorePassIdx = pickIndex(scorePass, betType);

  const funnel = emptyFunnel();
  const missCounts = emptyMissCounts();
  const missRows = [];

  for (const frozenRace of frozenRaces ?? []) {
    const live = liveById.get(frozenRace.id);
    const payouts = live?.result?.payouts ?? [];
    for (const payout of payouts) {
      if (payout.betType !== betType) continue;
      if (!(payout.payoutYen > 0)) continue;

      const key = comboKey(frozenRace.id, betType, payout.selection);
      const board = frozenBoardEntry(frozenRace, betType, payout.selection);
      const onBoard = board != null && board.odds != null;
      const gated = onBoard && inOddsGate(board.odds, settings);
      const genPick = generatedIdx.get(key);
      const scorePick = scorePassIdx.get(key);
      const prodPick = produced.get(key);
      const inGenerated = Boolean(genPick);
      const inScorePass = Boolean(scorePick);
      const inTopN = Boolean(prodPick);
      const watch = prodPick?.label === SANREN_WATCH_LABEL;

      funnel.payouts += 1;
      if (onBoard) {
        funnel.onBoard += 1;
        if (gated) {
          funnel.gated += 1;
          if (inGenerated) {
            funnel.generated += 1;
            if (inScorePass) {
              funnel.scorePass += 1;
              if (inTopN) {
                funnel.topN += 1;
                if (watch) funnel.watch += 1;
              }
            }
          }
        }
      }

      const missKind = classifySanrenMiss({
        onBoard,
        gated,
        inGenerated,
        inScorePass,
        inTopN,
      });
      if (missKind) {
        missCounts[missKind] += 1;
        missRows.push({
          raceId: frozenRace.id,
          venue: frozenRace.venue ?? live?.venue ?? null,
          raceNumber: frozenRace.raceNumber ?? live?.raceNumber ?? null,
          selection: payout.selection,
          payoutYen: payout.payoutYen,
          odds: onBoard ? board.odds : null,
          missKind,
          relatedScore:
            scorePick?.relatedScore ??
            genPick?.relatedScore ??
            prodPick?.relatedScore ??
            null,
          label: prodPick?.label ?? null,
          pattern: genPick?.pattern ?? scorePick?.pattern ?? prodPick?.pattern ?? null,
        });
      }
    }
  }

  return {
    lane,
    betType,
    funnel,
    rates: funnelRates(funnel),
    missCounts,
    missRows,
    note: "払戻起点の入れ子ファネル。レーン合算しない。主指標は ticketPrecision のまま。",
  };
}

export function formatFunnelLine(funnel) {
  const f = funnel ?? emptyFunnel();
  return `payouts=${f.payouts} onBoard=${f.onBoard} gated=${f.gated} generated=${f.generated} scorePass=${f.scorePass} topN=${f.topN} watch=${f.watch}`;
}

export function formatMissLine(missCounts) {
  const m = missCounts ?? emptyMissCounts();
  return MISS_KINDS.map((k) => `${k}=${m[k] ?? 0}`).join(" ");
}
