/**
 * C1/C2: 人気・前走から因子を導出（合成 factors を上書きする）。
 * ruleBased.ts / loop-domain.mjs / horse-form.mjs で共有。
 */

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

/**
 * C2: formStats（前走着順・人気・同条件平均着順）→ formSignal。
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
  return clampScore(score, 35, 92);
}
