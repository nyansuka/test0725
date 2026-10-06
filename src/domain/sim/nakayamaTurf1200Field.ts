import {
  cornerRates,
  styleFromTurfRuns,
  styleRuns,
  turfRunsBefore,
  type StyleFocus,
  type StyleRun,
} from "@/domain/sim/runningStyle";
import type { RunningStyle } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * レースの出走馬と過去走から、芝ワンターンの走行に渡す馬を作る。
 * 馬番・枠・馬名と、脚質に使った発走前の芝の通過だけ。着順・オッズは見ない。
 */

export type TurfPass = {
  date: string;
  passFirst: number | null;
  passLast: number | null;
  fieldSize: number | null;
};

export type FieldHorse = {
  number: number;
  bracket: number;
  name: string;
  style: RunningStyle;
  turfPasses: TurfPass[];
  posRate?: number | null;
  corner3Rate?: number | null;
  corner4Rate?: number | null;
  paceFrontSec?: number | null;
};

export type FieldEntry = {
  number: number;
  bracket?: number;
  name: string;
};

export function simFieldFromRuns(
  entries: FieldEntry[],
  runsByNumber: ReadonlyMap<number, StyleRun[]>,
  raceDate: string,
  focus?: StyleFocus,
): { horses: FieldHorse[]; withoutPass: string[] } {
  const horses = entries
    .map((entry) => {
      const runs = runsByNumber.get(entry.number) ?? [];
      const used = styleRuns(runs, raceDate, focus);
      const rates = cornerRates(used);
      const turfPasses = turfRunsBefore(runs, raceDate).map((run) => ({
        date: run.date,
        passFirst: run.passFirst ?? null,
        passLast: run.passLast ?? null,
        fieldSize: run.fieldSize ?? null,
      }));
      return {
        number: entry.number,
        bracket: entry.bracket ?? 1,
        name: entry.name,
        style: styleFromTurfRuns(runs, raceDate, focus).style,
        turfPasses,
        posRate: rates.posRate,
        corner3Rate: rates.corner3Rate,
        corner4Rate: rates.corner4Rate,
        paceFrontSec: rates.paceFrontSec,
      };
    })
    .sort((a, b) => a.number - b.number);

  return {
    horses,
    withoutPass: horses.filter((horse) => horse.turfPasses.length === 0).map((horse) => horse.name),
  };
}
