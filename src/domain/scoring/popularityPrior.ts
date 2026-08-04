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
