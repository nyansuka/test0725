/**
 * 4角の絵と、実際の通過順。着順は使わない。
 * 通過が無い馬は比べない。結果ページに通過が無いときは、馬成績の最後の通過だけ。
 */

export type PictureSpot = {
  number: number;
  behindM: number;
};

export type ActualSpot = {
  number: number;
  /** 4角の通過。小さいほど前 */
  pass: number;
};

export function actualFourthPass(run: {
  passParts?: number[] | null;
  passLast?: number | null;
}) {
  const parts = run.passParts?.filter((pos) => pos >= 1);
  if (parts && parts.length) return parts[parts.length - 1];
  if (run.passLast != null && run.passLast >= 1) return run.passLast;
  return null;
}

function ranks(rows: { number: number; key: number }[]) {
  return [...rows]
    .sort((a, b) => a.key - b.key || a.number - b.number)
    .map((row, index) => ({ number: row.number, rank: index + 1 }));
}

/**
 * 両方にいる馬だけで、順位差の平均。2頭未満は測れないので null。
 */
export function meanAbsRankError(picture: PictureSpot[], actual: ActualSpot[]) {
  const actualByNumber = new Map(actual.map((row) => [row.number, row.pass]));
  const both = picture.filter((row) => actualByNumber.has(row.number));
  if (both.length < 2) return null;
  const pictured = ranks(both.map((row) => ({ number: row.number, key: row.behindM })));
  const passed = ranks(both.map((row) => ({ number: row.number, key: actualByNumber.get(row.number) as number })));
  const passedRank = new Map(passed.map((row) => [row.number, row.rank]));
  const total = pictured.reduce((sum, row) => sum + Math.abs(row.rank - (passedRank.get(row.number) as number)), 0);
  return { horses: both.length, meanAbs: total / both.length };
}
