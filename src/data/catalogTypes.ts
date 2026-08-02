import type { Race } from "@/domain/types";

/** SSR / API / RaceCatalogProvider で共有するカタログ初期値 */
export type RaceCatalogPayload = {
  races: Race[];
  fetchedAt: string | null;
  source: string | null;
  raceDate: string | null;
};
