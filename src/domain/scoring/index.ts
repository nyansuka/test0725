import type { Scorer } from "./ruleBased";
import { ruleBasedScorer } from "./ruleBased";

export type { ScoreResult, Scorer } from "./ruleBased";
export { trackGateBiasScore } from "./trackGateBias.mjs";

let currentScorer: Scorer = ruleBasedScorer;

export function getScorer(): Scorer {
  return currentScorer;
}

export function setScorer(scorer: Scorer) {
  currentScorer = scorer;
}

export { ruleBasedScorer };
