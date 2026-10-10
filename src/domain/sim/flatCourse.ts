import { chukyoFlatGeom, CHUKYO_TEMPLATES } from "@/domain/sim/chukyoCourse";
import { buildFlatCapPhases, buildFlatCapScript } from "@/domain/sim/flatCapScript";
import { flatRow } from "@/domain/sim/flatSimCatalog";
import { fukushimaFlatGeom, FUKUSHIMA_TEMPLATES } from "@/domain/sim/fukushimaCourse";
import { hakodateFlatGeom, HAKODATE_TEMPLATES } from "@/domain/sim/hakodateCourse";
import { hanshinFlatGeom, HANSHIN_TEMPLATES } from "@/domain/sim/hanshinCourse";
import { kokuraFlatGeom, KOKURA_TEMPLATES } from "@/domain/sim/kokuraCourse";
import { kyotoFlatGeom, KYOTO_TEMPLATES } from "@/domain/sim/kyotoCourse";
import { nakayamaFlatGeom, NAKAYAMA_TEMPLATES } from "@/domain/sim/nakayamaCourse";
import { niigataFlatGeom, NIIGATA_TEMPLATES } from "@/domain/sim/niigataCourse";
import { projectTurf } from "@/domain/sim/projectTurf";
import { sapporoFlatGeom, SAPPORO_TEMPLATES } from "@/domain/sim/sapporoCourse";
import { tokyoFlatGeom, TOKYO_TEMPLATES } from "@/domain/sim/tokyoCourse";
import type { SimHorse } from "@/domain/sim/nakayamaTurf1200Script";
import { createTurfCourse } from "@/domain/sim/turfCoursePlay";
import type { FlatPath } from "@/domain/sim/flatPath";

/**
 * ワンターン以外の平地。台本は共有し、直線の上限だけコースごとに切る。
 * 中山芝1200と、既につながっている芝ワンターンはここを通さない。
 */

type Words = { id: string; course: string; place: string; summary: string };

const GEOM: Record<string, (templateId: string) => FlatPath | null> = {
  nakayama: nakayamaFlatGeom,
  tokyo: tokyoFlatGeom,
  hanshin: hanshinFlatGeom,
  kyoto: kyotoFlatGeom,
  chukyo: chukyoFlatGeom,
  niigata: niigataFlatGeom,
  sapporo: sapporoFlatGeom,
  hakodate: hakodateFlatGeom,
  fukushima: fukushimaFlatGeom,
  kokura: kokuraFlatGeom,
};

const WORDS: Record<string, Words[]> = {
  nakayama: NAKAYAMA_TEMPLATES,
  tokyo: TOKYO_TEMPLATES,
  hanshin: HANSHIN_TEMPLATES,
  kyoto: KYOTO_TEMPLATES,
  chukyo: CHUKYO_TEMPLATES,
  niigata: NIIGATA_TEMPLATES,
  sapporo: SAPPORO_TEMPLATES,
  hakodate: HAKODATE_TEMPLATES,
  fukushima: FUKUSHIMA_TEMPLATES,
  kokura: KOKURA_TEMPLATES,
};

function labelsOf(id: string, path: FlatPath, meters: number) {
  if (id === "niigata-turf-1000") {
    return [
      { m: 16, text: "発走", out: 58 },
      { m: 100, text: "上り", out: 58 },
      { m: 200, text: "平坦", out: 58 },
      { m: 1000, text: "ゴール", out: 58 },
    ];
  }
  const rows = [{ m: 16, text: "発走", out: 58 }];
  if (path.corner1 > 30 && path.corner1 < path.corner3 - 16) rows.push({ m: path.corner1, text: "1角", out: 58 });
  rows.push({ m: path.corner3, text: "3角", out: 58 }, { m: path.corner4, text: "4角", out: 58 }, { m: path.straightFrom, text: "直線", out: 58 });
  if (path.hills[0]) rows.push({ m: (path.hills[0][0] + path.hills[0][1]) / 2, text: "坂", out: 58 });
  rows.push({ m: meters, text: "ゴール", out: 58 });
  return rows;
}

const VIEW_CACHE = new Map<string, NonNullable<ReturnType<typeof buildFlatCourse>>>();

function buildFlatCourse(id: string) {
  const row = flatRow(id);
  const slug = id.split("-")[0];
  if (!row || !GEOM[slug] || !WORDS[slug]) return null;
  const surface = row.track === "芝" ? "turf" : "dirt";
  const templateId = id.endsWith("-outer") ? `${surface}-${row.meters}-outer` : `${surface}-${row.meters}`;
  const path = GEOM[slug](templateId);
  const words = WORDS[slug].find((item) => item.id === templateId);
  if (!path || !words) return null;
  const projected = projectTurf(path.idle, path.run, path.approach);
  const straightOnly = id === "niigata-turf-1000";
  return {
    id,
    raceMeters: row.meters,
    viewBox: projected.viewBox,
    title: projected.title,
    note: projected.note,
    titleText: `${row.venue}${row.track}${row.meters}`,
    subtitle: words.course,
    noteText: words.place,
    aria: `${row.venue}${row.track}${row.meters}の想定走行。${words.summary}`,
    facts: [words.course, words.place, words.summary],
    track: projected.coursePathD,
    gate: projected.gatePathD(),
    hill: path.hills.map(([from, to]) => projected.hillPathD(from, to)).join(" "),
    idle: projected.unusedPathD,
    labels: labelsOf(id, path, row.meters),
    pointAt: projected.pointAt,
    markerAt: projected.markerAt,
    play(horses: SimHorse[]) {
      return createTurfCourse(horses, {
        raceMeters: row.meters,
        pointAt: projected.pointAt,
        phases: buildFlatCapPhases(horses, {
          corner1: path.corner1,
          corner3: path.corner3,
          corner4: path.corner4,
          straightFrom: path.straightFrom,
          meters: row.meters,
          stretch: row.stretch,
          place: words.place,
          straightOnly,
        }),
        script: buildFlatCapScript(horses),
        stretch: row.stretch,
      });
    },
  };
}

export function flatCourseView(id: string) {
  const cached = VIEW_CACHE.get(id);
  if (cached) return cached;
  const built = buildFlatCourse(id);
  if (built) VIEW_CACHE.set(id, built);
  return built;
}
