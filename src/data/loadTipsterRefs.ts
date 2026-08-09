import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { TipsterRaceView, TipsterRefBundle } from "@/domain/tipsterRef";
import { tipsterByNumber } from "@/domain/tipsterRef";

const FILE_RE = /^kota-indexes-\d{4}-\d{2}-\d{2}\.json$/;

async function loadBundles(): Promise<TipsterRefBundle[]> {
  const dir = path.join(process.cwd(), "src", "data", "external");
  try {
    const names = (await readdir(dir)).filter((n) => FILE_RE.test(n));
    const bundles = await Promise.all(
      names.map(async (name) => {
        const raw = await readFile(path.join(dir, name), "utf8");
        return JSON.parse(raw) as TipsterRefBundle;
      }),
    );
    return bundles.filter((b) => b.usage === "manual-reference-only" && Array.isArray(b.races));
  } catch {
    return [];
  }
}

/** レースIDに紐づくプロ予想参考（無ければ null）。Scorer とは独立。 */
export async function loadTipsterRaceRef(raceId: string): Promise<TipsterRaceView | null> {
  const bundles = await loadBundles();
  for (const bundle of bundles) {
    const race = bundle.races.find((r) => r.raceId === raceId);
    if (!race) continue;
    return {
      tipsterId: bundle.tipsterId,
      tipsterName: bundle.tipsterName,
      raceDate: bundle.raceDate,
      note: bundle.note,
      referenceUrl: bundle.referenceUrl,
      race,
      byNumber: tipsterByNumber(race),
    };
  }
  return null;
}

/** クライアント／API 用に Map を除いたペイロード */
export async function loadTipsterRacePayload(raceId: string) {
  const view = await loadTipsterRaceRef(raceId);
  if (!view) return null;
  return {
    tipsterId: view.tipsterId,
    tipsterName: view.tipsterName,
    raceDate: view.raceDate,
    note: view.note,
    referenceUrl: view.referenceUrl,
    race: view.race,
  };
}
