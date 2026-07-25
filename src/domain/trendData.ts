import type { TrendIndex } from "./trends";
import { EMPTY_TRENDS } from "./trends";
import trendsJson from "@/data/loop/trends/latest.json";

export function getTrendIndex(): TrendIndex {
  const t = trendsJson as TrendIndex;
  if (!t?.dayCount) return EMPTY_TRENDS;
  return t;
}
