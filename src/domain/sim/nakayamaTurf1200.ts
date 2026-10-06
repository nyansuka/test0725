/**
 * 中山芝1200。点列・台本・再生に分かれている。
 * 見本16頭は 2026-09-26 中山10R 勝浦特別。
 */

export type { RunningStyle, SimHorse, SimPhase } from "@/domain/sim/nakayamaTurf1200Script";
export { HORSES } from "@/domain/sim/nakayamaTurf1200Script";

export {
  COURSE_NOTE,
  COURSE_TITLE,
  COURSE_VIEWBOX,
  HILL_FROM,
  HILL_TO,
  RACE_METERS,
  coursePathD,
  gatePathD,
  hillPathD,
  markerAt,
  pointAt,
  unusedPathD,
} from "@/domain/sim/nakayamaTurf1200Path";

export {
  BRACKET_COLOR,
  MARKER_R,
  TRACK_STROKE,
  createTurf1200,
  horseXY,
  lengthsLabel,
  type Placement,
} from "@/domain/sim/nakayamaTurf1200Play";
