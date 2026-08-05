/**
 * 軸（1着）用の人気事前スコア。
 * 根拠: TFJV `Race Results2000.csv`（2000-01〜2026-07・91645R）。
 * 1着の約65%が人気Top3、6〜10人気が約15.6%、11人気以下は約2.8%。
 * 短窓 202601–202608（1866R）も同水準（Top3 64.4% / 6-10 16.1% / 11+ 2.5%）。
 */
export function popularityWinScore(popularity: number | null | undefined): number {
  if (popularity == null || popularity < 1) return 40;
  if (popularity === 1) return 92;
  if (popularity === 2) return 78;
  if (popularity === 3) return 68;
  if (popularity === 4) return 58;
  if (popularity === 5) return 50;
  if (popularity === 6) return 42;
  if (popularity === 7) return 34;
  if (popularity === 8) return 28;
  if (popularity === 9) return 22;
  if (popularity === 10) return 16;
  return 8; // 11人気以下
}

/** 因子ベースと人気事前の合成比率（人気側を厚く） */
export const WIN_POP_BLEND = 0.62;

/** 中穴（6〜10）の適性合成（昇格判定用） */
export function midLongshotComposite(horse: {
  factors?: { formSignal?: number; courseFit?: number; paceFit?: number };
}): number {
  const f = horse.factors ?? {};
  return (
    (f.formSignal ?? 50) * 0.5 +
    (f.courseFit ?? 50) * 0.35 +
    (f.paceFit ?? 50) * 0.15
  );
}

/** 中穴昇格の適性下限 */
export const MID_COMPOSITE_MIN = 65;

/**
 * 同条件ベストタイムがレース内で「好タイム」とみなす上位帯。
 * bestTimeSec がある馬だけを母数に昇順順位付けする。
 */
export const MID_TIME_TOP_PCT = 0.2;

/**
 * 3枠目差し替え時、中穴の winPotential が 3位以内にどれだけ近づけばよいか。
 * 大きいほど昇格しやすいが人気軸の的中を削る。
 */
export const MID_REPLACE_GAP = 18;

/**
 * レース内の同条件ベストタイム順位が上位 `topPct` 帯か（好タイム）。
 * 比較可能なタイムが2頭未満なら false。
 */
export function isRaceTopTime(
  horse: { number: number; formStats?: { bestTimeSec?: number | null } },
  horses: Array<{ number: number; formStats?: { bestTimeSec?: number | null } }>,
  topPct: number = MID_TIME_TOP_PCT,
): boolean {
  const timed = horses
    .map((h) => ({ number: h.number, t: h.formStats?.bestTimeSec ?? null }))
    .filter((x): x is { number: number; t: number } => x.t != null && Number.isFinite(x.t));
  if (timed.length < 2) return false;
  timed.sort((a, b) => a.t - b.t || a.number - b.number);
  const cutoff = Math.max(1, Math.ceil(timed.length * topPct));
  const idx = timed.findIndex((x) => x.number === horse.number);
  return idx >= 0 && idx < cutoff;
}
