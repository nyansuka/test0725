/**
 * 軸（1着）用の人気事前スコア。
 * 根拠: TARGET CSV 202601–202608（1866R）で 1着の約64%が人気Top3、11人気以下は約2.5%。
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
 * 3枠目差し替え時、中穴の winPotential が 3位以内にどれだけ近づけばよいか。
 * 大きいほど昇格しやすいが人気軸の的中を削る。
 */
export const MID_REPLACE_GAP = 15;
