import type {
  BetSlip,
  BetType,
  JournalSettings,
  JournalSummary,
} from "./types";

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
