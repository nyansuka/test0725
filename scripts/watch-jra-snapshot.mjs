/**
 * レース終了後に結果を自動取得するウォッチャー。
 * 発走時刻 + grace 分を過ぎた未結果レースだけ差分取得する。
 *
 *   node scripts/watch-jra-snapshot.mjs
 *   INTERVAL_SEC=90 GRACE_MIN=8 node scripts/watch-jra-snapshot.mjs
 */
import { updateResultsOnly, ymdFromArg, jstNowParts } from "./fetch-jra-snapshot.mjs";

const intervalSec = Number(process.env.INTERVAL_SEC ?? 90);
const graceMinutes = Number(process.env.GRACE_MIN ?? 8);

async function tick() {
  const { date } = jstNowParts();
  const raceDate = process.argv[2] && !process.argv[2].startsWith("-")
    ? process.argv[2]
    : date;
  console.log(`[watch] ${new Date().toISOString()} date=${raceDate} grace=${graceMinutes}m`);
  try {
    await updateResultsOnly(raceDate, { graceMinutes });
  } catch (err) {
    console.error("[watch] error", err);
  }
}

console.log(`[watch] started interval=${intervalSec}s`);
await tick();
setInterval(tick, intervalSec * 1000);
