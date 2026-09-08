/** 2026-09-12 / 09-13 の週末実験。既存ゲート内候補は残し、追加分だけ 検討。 */
export const WEEKEND_EXPERIMENT_DATES = ["2026-09-12", "2026-09-13"] as const;

export const EXPERIMENT_LABEL = "検討" as const;

export function isWeekendExperiment(raceDate: string | null | undefined): boolean {
  return raceDate === "2026-09-12" || raceDate === "2026-09-13";
}

/** ボード表記。実験追加は 候補（検討）。既存は 候補（注目穴）など。 */
export function formatCandidateLabel(label: string): string {
  if (label.startsWith("候補（") && label.endsWith("）")) return label;
  return `候補（${label}）`;
}
