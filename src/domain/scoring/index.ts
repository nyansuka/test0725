import type { Scorer } from "./ruleBased";
import { ruleBasedScorer } from "./ruleBased";

export type { ScoreResult, Scorer } from "./ruleBased";
export { trackGateBiasScore } from "./trackGateBias.mjs";
export { popularityWinScore, WIN_POP_BLEND, midLongshotComposite, MID_COMPOSITE_MIN, MID_REPLACE_GAP } from "./popularityPrior";

let currentScorer: Scorer = ruleBasedScorer;

export function getScorer(): Scorer {
  return currentScorer;
}

export function setScorer(scorer: Scorer) {
  currentScorer = scorer;
}

export { ruleBasedScorer };
