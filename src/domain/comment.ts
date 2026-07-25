import type { BetType, Horse, LongshotLabel, Race } from "./types";
import { trendsExcludingDate, type TrendBucket, type TrendIndex } from "./trends";
import { BET_TYPE_LABELS } from "./betTypes";
import { getScorer } from "./scoring";

export type CommentPickContext = {
  betType: BetType;
  venue: string;
  track: "芝" | "ダート";
  odds: number;
  label: LongshotLabel;
  /** 短評から除外する開催日（通常は表示中の開催日） */
  excludeRaceDate?: string;
};

function oddsBand(odds: number): string {
  if (odds < 50) return "20-49";
  if (odds < 100) return "50-99";
  return "100+";
}

function pct(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return `${(p * 100).toFixed(1)}%`;
}

function usable(bucket: TrendBucket | undefined, minSamples: number): bucket is TrendBucket {
  return Boolean(bucket && bucket.settled >= minSamples && bucket.precision != null);
}

/** 蓄積評価から、短評用の傾向一文を作る（馬成績ではない） */
export function formatTrendPhrase(
  ctx: CommentPickContext,
  trends: TrendIndex | null | undefined,
): string | null {
  if (!trends || trends.dayCount === 0) {
    return "傾向:蓄積なし（loop:evaluate 後に表示）";
  }

  let view = trendsExcludingDate(trends, ctx.excludeRaceDate);
  let provisional = false;

  // 他日が無いときは当日蓄積を表示（リーク注意の注記付き）
  if (!view && ctx.excludeRaceDate) {
    view = trendsExcludingDate(trends, undefined);
    provisional = true;
  }
  if (!view) {
    return "傾向:蓄積なし";
  }

  const min = view.minSamples;
  const overall = view.overall.precision;

  const candidates: { label: string; bucket: TrendBucket }[] = [];

  const vt = view.byVenueTrack[`${ctx.venue}|${ctx.track}`];
  if (usable(vt, min)) {
    candidates.push({ label: `${ctx.venue}${ctx.track}`, bucket: vt });
  }

  const bt = view.byBetType[ctx.betType];
  if (usable(bt, Math.min(min, 15))) {
    candidates.push({
      label: BET_TYPE_LABELS[ctx.betType] ?? ctx.betType,
      bucket: bt,
    });
  }

  const band = view.byOddsBand[oddsBand(ctx.odds)];
  if (usable(band, min)) {
    candidates.push({ label: `オッズ帯${oddsBand(ctx.odds)}`, bucket: band });
  }

  const lab = view.byLabel[ctx.label];
  if (usable(lab, min)) {
    candidates.push({ label: ctx.label, bucket: lab });
  }

  if (candidates.length === 0) {
    return `傾向:サンプル不足（蓄積${view.dayCount}日）`;
  }

  candidates.sort((a, b) => {
    const da = Math.abs((a.bucket.precision ?? 0) - (overall ?? 0));
    const db = Math.abs((b.bucket.precision ?? 0) - (overall ?? 0));
    return db - da;
  });

  const best = candidates[0];
  const p = best.bucket.precision ?? 0;
  let tone = "";
  if (overall != null && overall > 0) {
    if (p >= overall * 1.4) tone = "相対的に厚い・";
    else if (p <= overall * 0.6) tone = "相対的に薄い・";
  }

  const dayNote = provisional
    ? `${view.dayCount}日分・当日検証含む`
    : `${view.dayCount}日分`;

  return `傾向:${tone}${best.label}の候補的中率${pct(best.bucket.precision)}（n=${best.bucket.settled}・${dayNote}）`;
}

function factorHighlight(horse: Horse, race: Race): string {
  const { factors, placePotential } = getScorer().score(horse, race);
  const entries: [string, number][] = [
    ["コース", factors.courseFit],
    ["展開", factors.paceFit],
    ["馬場", factors.conditionFit],
    ["近況", factors.formSignal],
    ["乖離", factors.valueGap],
    ["枠騎", factors.gateJockey ?? 50],
  ];
  const top = entries.sort((a, b) => b[1] - a[1]).slice(0, 2);
  return `評価:潜在${placePotential}・${top.map(([k, v]) => `${k}${v}`).join("・")}`;
}

/** 今日の注目穴など向けの短評（ベース＋評価＋過去傾向） */
export function buildPickComment(
  race: Race,
  related: Horse[],
  ctx: CommentPickContext,
  trends?: TrendIndex | null,
): string {
  if (related.length === 0) return "関係馬の評価が不足しています。";

  const best = [...related].sort(
    (a, b) =>
      getScorer().score(b, race).placePotential - getScorer().score(a, race).placePotential,
  )[0];

  const base = best.comment?.trim() || `${best.name}の複勝圏余地を確認。`;
  const evalPart = factorHighlight(best, race);
  const trendPart = formatTrendPhrase(ctx, trends);

  return [base, evalPart, trendPart].filter(Boolean).join(" ／ ");
}
