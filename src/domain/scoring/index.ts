import type { Scorer } from "./ruleBased";
import { ruleBasedScorer } from "./ruleBased";

export type { ScoreResult, Scorer } from "./ruleBased";

let currentScorer: Scorer = ruleBasedScorer;

export function getScorer(): Scorer {
  return currentScorer;
}

export function setScorer(scorer: Scorer) {
  currentScorer = scorer;
}

export { ruleBasedScorer };
