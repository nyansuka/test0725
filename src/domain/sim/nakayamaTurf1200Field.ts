import { SPAN_M } from "@/domain/sim/fieldShape";
import {
  cornerRates,
  stretchGainRate,
  styleFromTurfRuns,
  styleRuns,
  passRunsBefore,
  type StyleFocus,
  type StyleRun,
} from "@/domain/sim/runningStyle";
import type { RunningStyle } from "@/domain/sim/nakayamaTurf1200Script";

/**
 * レースの出走馬と過去走から、平地の走行に渡す馬を作る。
 * 馬番・枠・馬名と、脚質に使った発走前の通過。芝のレースは芝、ダートはダート。
 * 着順は、最後の通過から直線で詰めた幅だけに使う。オッズと上がりは見ない。
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
  stretchGainM?: number | null;
  /** 発走前のこの馬場の通過が無い */
  passUnknown: boolean;
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
      const surface = focus?.track === "ダート" ? "ダート" : "芝";
      const used = styleRuns(runs, raceDate, focus);
      const rates = cornerRates(used);
      const gainRate = stretchGainRate(used);
      const turfPasses = passRunsBefore(runs, raceDate, surface).map((run) => ({
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
        stretchGainM: gainRate == null ? null : gainRate * SPAN_M,
        passUnknown: turfPasses.length === 0,
      };
    })
    .sort((a, b) => a.number - b.number);

  return {
    horses,
    withoutPass: horses.filter((horse) => horse.passUnknown).map((horse) => horse.name),
  };
}
