import type {
  BetSlip,
  BetType,
  JournalSettings,
  JournalSummary,
} from "./types";
import { parseSelectionNumbers } from "./betTypes";

export const DEFAULT_JOURNAL_SETTINGS: JournalSettings = {
  excludePendingFromReturnRate: true,
  defaultVirtualStakeYen: 100,
};

export type JournalBetLine = {
  id: string;
  betType: BetType;
  selection: string;
  stakeYen: number;
  oddsAtPurchase: string;
  payoutYen: string;
};

/** 空行を除き、買い目が埋まっている券種行だけ返す */
export function filledBetLines(lines: JournalBetLine[]): JournalBetLine[] {
  return lines.filter((line) => line.selection.trim().length > 0);
}

function selectionLegCount(betType: BetType): number {
  if (betType === "win" || betType === "place") return 1;
  if (betType === "trio" || betType === "trifecta") return 3;
  return 2;
}

function formatTicket(betType: BetType, nums: number[]): string {
  const unordered = new Set<BetType>(["quinella", "wide", "bracket_quinella", "trio"]);
  const legs = unordered.has(betType) ? [...nums].sort((a, b) => a - b) : nums;
  return legs.join("-");
}

/**
 * 買い目文字列を個別チケットに展開する。
 * - `1-2,3,4` / `1=2,3,4` … 軸ながし（2頭券）→ 1-2, 1-3, 1-4
 * - `1,2,3`（単勝・複勝）→ 1 / 2 / 3
 * - `1-2,3-4` … 完成買い目の列挙
 * - それ以外は1件のまま
 */
export function expandSelectionTickets(betType: BetType, raw: string): string[] {
  const normalized = raw
    .trim()
    .replace(/[＝=]/g, "-")
    .replace(/[－ー−]/g, "-")
    .replace(/[、]/g, ",");
  if (!normalized) return [];

  const parts = normalized
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return [];

  const legCount = selectionLegCount(betType);
  const parsedParts = parts.map((p) => parseSelectionNumbers(p));

  // 単複: カンマ区切りの馬番列
  if (legCount === 1) {
    const nums = parsedParts.flat();
    return [...new Set(nums)].map(String);
  }

  // 完成買い目の列挙: 各パートが必要脚数以上
  if (parts.length >= 2 && parsedParts.every((n) => n.length >= legCount)) {
    const tickets = parsedParts.map((n) => formatTicket(betType, n.slice(0, legCount)));
    return [...new Set(tickets)];
  }

  // 2頭券の軸ながし: 先頭が「軸-相手」で以降が単独馬番
  if (
    legCount === 2 &&
    parts.length >= 2 &&
    parsedParts[0].length === 2 &&
    parsedParts.slice(1).every((n) => n.length === 1)
  ) {
    const [axis, firstPartner] = parsedParts[0];
    const partners = [firstPartner, ...parsedParts.slice(1).map((n) => n[0])];
    const tickets = partners
      .filter((p) => p !== axis)
      .map((p) => formatTicket(betType, [axis, p]));
    return [...new Set(tickets)];
  }

  // 3頭券の簡易ながし: `1-2-3,4,5` → 軸2頭固定 + 相手流し（trio/trifecta）
  if (
    legCount === 3 &&
    parts.length >= 2 &&
    parsedParts[0].length === 3 &&
    parsedParts.slice(1).every((n) => n.length === 1)
  ) {
    const [a, b, firstC] = parsedParts[0];
    const thirds = [firstC, ...parsedParts.slice(1).map((n) => n[0])];
    const tickets = thirds
      .filter((c) => c !== a && c !== b)
      .map((c) =>
        betType === "trifecta" ? `${a}-${b}-${c}` : formatTicket(betType, [a, b, c]),
      );
    return [...new Set(tickets)];
  }

  const nums = parseSelectionNumbers(normalized);
  if (nums.length === 0) return [normalized];
  if (nums.length < legCount) return [normalized];
  return [formatTicket(betType, nums.slice(0, legCount))];
}

/** 行ごとの買い目を展開し、保存用のフラットなリストにする */
export function expandBetLinesForSave(lines: JournalBetLine[]): Array<{
  betType: BetType;
  selection: string;
  stakeYen: number;
  oddsAtPurchase: string;
  payoutYen: string;
}> {
  const out: Array<{
    betType: BetType;
    selection: string;
    stakeYen: number;
    oddsAtPurchase: string;
    payoutYen: string;
  }> = [];
  for (const line of filledBetLines(lines)) {
    const tickets = expandSelectionTickets(line.betType, line.selection);
    for (const selection of tickets) {
      out.push({
        betType: line.betType,
        selection,
        stakeYen: line.stakeYen,
        oddsAtPurchase: line.oddsAtPurchase,
        payoutYen: line.payoutYen,
      });
    }
  }
  return out;
}

export function isHit(slip: BetSlip): boolean {
  return slip.payoutYen != null && slip.payoutYen > 0;
}

export function summarizeJournal(
  slips: BetSlip[],
  range: { from: string; to: string },
  sourceFilter: "self" | "tipster" | "all",
  settings: JournalSettings = DEFAULT_JOURNAL_SETTINGS,
): JournalSummary {
  const fromMs = Date.parse(range.from);
  const toMs = Date.parse(range.to);

  const filtered = slips.filter((slip) => {
    if (sourceFilter !== "all" && slip.source !== sourceFilter) return false;
    const t = Date.parse(slip.createdAt);
    if (Number.isFinite(fromMs) && t < fromMs) return false;
    if (Number.isFinite(toMs) && t > toMs) return false;
    return true;
  });

  const pendingCount = filtered.filter((s) => s.payoutYen === null).length;
  const settled = settings.excludePendingFromReturnRate
    ? filtered.filter((s) => s.payoutYen !== null)
    : filtered;

  const stakeTotal = settled.reduce((sum, s) => sum + s.stakeYen, 0);
  const payoutTotal = settled.reduce((sum, s) => sum + (s.payoutYen ?? 0), 0);
  const hitCount = settled.filter(isHit).length;
  const settledCount = settled.length;

  return {
    from: range.from,
    to: range.to,
    sourceFilter,
    stakeTotal,
    payoutTotal,
    returnRatePercent: stakeTotal === 0 ? 0 : Math.round((payoutTotal / stakeTotal) * 1000) / 10,
    profitYen: payoutTotal - stakeTotal,
    betCount: filtered.length,
    hitCount,
    hitRatePercent:
      settledCount === 0 ? null : Math.round((hitCount / settledCount) * 1000) / 10,
    settledCount,
    pendingCount,
  };
}
