/**
 * C1/C2: 人気・前走から因子を導出（合成 factors を上書きする）。
 * ruleBased.ts / loop-domain.mjs / horse-form.mjs で共有。
 *
 * 前走着順は生の着順のまま使わない。そのレースのペース（ラップ）と
 * 通過・一般的な枠不利で読み替える。コースをハイ／スローに分類はしない。
 * パドックは見ない（補足ノートのみ）。
 */
import { trackGateBiasScore } from "./trackGateBias.mjs";

export function clampScore(n, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** formSignal データ無しの中立値（馬番合成は使わない） */
export const FORM_SIGNAL_NEUTRAL = 50;

/**
 * C1: 単勝人気 → valueGap（穴ボード向け）。
 * 6〜10人気を厚く、本命と大穴は抑える（高オッズ一辺倒の逆指標を避ける）。
 */
export function valueGapFromPopularity(popularity) {
  if (popularity == null || popularity < 1) return 50;
  const table = {
    1: 40,
    2: 44,
    3: 50,
    4: 58,
    5: 66,
    6: 78,
    7: 84,
    8: 82,
    9: 76,
    10: 70,
  };
  if (table[popularity] != null) return table[popularity];
  if (popularity <= 12) return 56;
  if (popularity <= 15) return 48;
  return 42;
}

/** 前半-後半。数字が小さい方が速い。delta>=0.5 でハイ（前半の方が速い） */
export function classifyPace(frontSec, backSec) {
  if (frontSec == null || backSec == null) return null;
  if (!Number.isFinite(frontSec) || !Number.isFinite(backSec)) return null;
  const delta = backSec - frontSec;
  if (delta >= 0.5) return "high";
  if (delta <= -0.5) return "slow";
  return "mid";
}

/** 最初の通過位置から先行／後方。場を瞬発／持続に分けない */
export function classifyTrip(passFirst, fieldSize) {
  if (passFirst == null || !Number.isFinite(passFirst) || passFirst < 1) return null;
  if (passFirst <= 2) return "front";
  if (fieldSize != null && Number.isFinite(fieldSize) && fieldSize >= 5) {
    if (passFirst / fieldSize <= 0.28) return "front";
    if (passFirst / fieldSize >= 0.62 || passFirst >= fieldSize - 1) return "back";
    return "mid";
  }
  if (passFirst >= 8) return "back";
  return "mid";
}

/** 芝の外枠・ダートの内枠は一般的に不利。日内のトラックバイアスではない */
function ranAgainstTypicalGate(track, bracket) {
  if (bracket == null || !Number.isFinite(Number(bracket))) return false;
  const b = Number(bracket);
  if (track === "ダート") return b <= 3;
  if (track === "芝") return b >= 6;
  return false;
}

/**
 * 着順の読み替え量。±8〜10 に閉じる。
 * スローで後方から好走／ハイで先行粘りは着順以上。その逆の楽な好走は着順ほど買わない。
 */
export function formContextAdjust(fs) {
  if (!fs) return 0;
  const rank = fs.lastRank;
  if (rank == null || rank < 1) return 0;

  let adj = 0;
  const pace = classifyPace(fs.lastPaceFrontSec, fs.lastPaceBackSec);
  const trip = classifyTrip(fs.lastPassFirst, fs.lastFieldSize);
  const placed = rank <= 5;
  const well = rank <= 3;
  const faded = rank >= 8;

  if (pace && trip) {
    if (pace === "slow" && trip === "back" && placed) adj += well ? 8 : 6;
    else if (pace === "high" && trip === "front" && placed) adj += well ? 8 : 6;
    else if (pace === "slow" && trip === "front" && well) adj -= 3;
    else if (pace === "high" && trip === "back" && well) adj -= 3;
    else if (pace === "slow" && trip === "back" && faded) adj += 3;
    else if (pace === "high" && trip === "front" && faded) adj += 2;
  }

  if (fs.lastPassLast != null && Number.isFinite(fs.lastPassLast)) {
    const gained = fs.lastPassLast - rank;
    if (gained >= 6) adj += 4;
    else if (gained >= 4 && rank <= 5) adj += 3;
  }

  if (
    fs.lastLast3fSec != null &&
    fs.lastPaceBackSec != null &&
    Number.isFinite(fs.lastLast3fSec) &&
    Number.isFinite(fs.lastPaceBackSec) &&
    fs.lastLast3fSec <= fs.lastPaceBackSec - 0.5 &&
    rank <= 6
  ) {
    adj += 3;
  }

  if (ranAgainstTypicalGate(fs.lastTrack, fs.lastBracket) && rank <= 4) {
    const gate = trackGateBiasScore(
      fs.lastTrack,
      fs.lastBracket,
      fs.lastVenue,
      fs.lastDistanceLabel,
    );
    if (gate <= 54) adj += 4;
  }

  return Math.max(-8, Math.min(10, adj));
}

export function formContextLabel(fs) {
  if (!fs || fs.lastRank == null) return "";
  const parts = [];
  const pace = classifyPace(fs.lastPaceFrontSec, fs.lastPaceBackSec);
  const trip = classifyTrip(fs.lastPassFirst, fs.lastFieldSize);
  if (pace === "high") parts.push("ハイペース");
  if (pace === "slow") parts.push("スロー");
  if (trip === "front") parts.push("先行");
  if (trip === "back") parts.push("後方");
  const adj = formContextAdjust(fs);
  if (adj >= 4) parts.push("着順以上");
  else if (adj <= -3) parts.push("着順ほど評価しない");
  return parts.length ? `（${parts.join("・")}）` : "";
}

/**
 * C2: formStats（前走着順・人気・同条件平均着順）→ formSignal。
 * 着順はペース・通過・枠の一般不利で読み替える。
 * @returns {number|null} 前走が無ければ null（呼び出し側で NEUTRAL）
 */
export function formSignalFromFormStats(fs) {
  if (!fs || fs.lastRank == null || fs.lastRank < 1) return null;
  let score = 72 - (fs.lastRank - 1) * 4;
  if (fs.lastPopularity != null) {
    const delta = fs.lastPopularity - fs.lastRank;
    score += Math.max(-8, Math.min(10, delta * 2));
  }
  if (fs.avgSameRank != null && fs.avgSameRank > 0) {
    const same = clampScore(98 - (fs.avgSameRank - 1) * 8, 30, 92);
    score = score * 0.7 + same * 0.3;
  }
  score += formContextAdjust(fs);
  return clampScore(score, 35, 92);
}

/** 1着向きの前走補正。着順読み替えを半分だけ乗せる */
export function winFormBoostFromStats(fs) {
  if (!fs) return 0;
  let boost = 0;
  if (fs.lastRank === 1) boost += 8;
  else if (fs.lastRank === 2) boost += 3;
  else if (fs.lastRank != null && fs.lastRank >= 8) boost -= 4;
  if (fs.avgSameRank != null && fs.avgSameRank > 0 && fs.avgSameRank <= 2.5) boost += 5;
  else if (fs.avgSameRank != null && fs.avgSameRank >= 6) boost -= 3;
  boost += Math.round(formContextAdjust(fs) * 0.5);
  return boost;
}
