/**
 * 走行シミュレーションの解説。まねき先生がコースの形と、その時点の並びを話す。
 * 着順の予想はしない。馬身は 0.5 刻みに丸め、再生中に文が揺れないようにする。
 * 仕掛けは、脚質と、最初の通過から最後の通過、最後の通過から着順までの前進。
 * 3角だけの位置は持っていない。直線の途中も、坂か直線の一つにまとめる。
 */
import { SPAN_M } from "@/domain/sim/fieldShape";

const LENGTH_M = 2.5;

export type CommentatorMood = "wait" | "talk" | "point" | "lean" | "done";

/** neko.jpg は 2×2。左上から 喜・怒・哀・楽 */
export type ManekiFrame = "ki" | "do" | "ai" | "raku";

export type CommentatorHorse = {
  number: number;
  name: string;
  style: string;
  behindM: number;
  passUnknown?: boolean;
  /** 最初の通過の位置率。3角だけの値は無い */
  corner3Rate?: number | null;
  /** 最後の通過の位置率 */
  corner4Rate?: number | null;
  /** 最後の通過から着順まで詰めたメートル */
  stretchGainM?: number | null;
};

/** 出馬表の注目穴。超注目はその交差 */
export type WatchHorse = {
  number: number;
  name: string;
  superWatch?: boolean;
};

export function commentatorMood(phaseId: string): CommentatorMood {
  if (phaseId === "goal") return "done";
  if (phaseId === "start") return "wait";
  if (phaseId === "c1" || phaseId === "c3" || phaseId === "c4") return "point";
  if (phaseId === "hill" || phaseId === "straight") return "lean";
  return "talk";
}

/** スタート前は楽、コーナーと坂は怒、それ以外は喜 */
export function manekiFrame(mood: CommentatorMood): ManekiFrame {
  if (mood === "wait") return "raku";
  if (mood === "point" || mood === "lean") return "do";
  return "ki";
}

export function racePoints(phases: { id: string; title: string }[]) {
  return phases.filter((phase) => phase.id !== "start" && phase.id !== "goal").map((phase) => phase.title);
}

function quoteList(items: string[]) {
  const quoted = items.map((item) => `「${item}」`);
  if (quoted.length <= 1) return quoted[0] ?? "";
  if (quoted.length === 2) return `${quoted[0]}と${quoted[1]}`;
  return `${quoted.slice(0, -1).join("、")}と${quoted[quoted.length - 1]}`;
}

/** 発走前。コースの特徴と、その先で見るポイント */
export function preStartSpeech(courseName: string, facts: string[], points: string[]) {
  const course = facts.length ? `コースの特徴は、${facts.join("、")}。` : "";
  const watch = points.length ? `見るところは${quoteList(points)}だよ。` : "";
  return `${courseName}の発走前だよ。${course}${watch}着順の予想じゃないから、型として見てね。`;
}

const ALREADY_FRIENDLY = /(だよ|だね|からね|てね)$/;
const SOFT_YOU = /(ない|やすい|にくい|たい|小さい|大きい|速い|早い|遅い|長い|短い|高い|低い|多い|少ない|強い|弱い)$/;
const VERB_END = /(る|く|す|う|つ|ぐ|ぶ|む|ぬ)$/;

function friendlyClose(sentence: string) {
  if (ALREADY_FRIENDLY.test(sentence)) return sentence;
  if (sentence.endsWith("です")) return `${sentence.slice(0, -2)}だよ`;
  if (sentence.endsWith("だ")) return `${sentence}よ`;
  if (SOFT_YOU.test(sentence) || VERB_END.test(sentence)) return `${sentence}よ`;
  return `${sentence}だよ`;
}

/** 事実はそのまま。最後の文だけ、先生の口調にする */
export function softenLast(body: string) {
  const parts = body
    .split("。")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.length) return body;
  parts[parts.length - 1] = friendlyClose(parts[parts.length - 1]);
  return parts.map((part) => `${part}。`).join("");
}

function horseName(horse: CommentatorHorse) {
  return `${horse.number}番${horse.name}（${horse.style}）`;
}

/** 2番手との差。先頭と並ぶときは馬身にしない */
export function spokenGap(behindM: number) {
  if (behindM < 0.6) return "ほぼ並んでいます";
  const steps = Math.round((behindM / LENGTH_M) * 2) / 2;
  const text = Number.isInteger(steps) ? String(steps) : steps.toFixed(1);
  return `先頭から${text}馬身`;
}

function joinJa(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]}と${items[1]}`;
  return `${items.slice(0, -1).join("、")}と${items[items.length - 1]}`;
}

function watchRows(watches: WatchHorse[], field: CommentatorHorse[]) {
  const byNumber = new Map(field.map((horse) => [horse.number, horse]));
  return watches
    .map((watch) => ({ watch, horse: byNumber.get(watch.number) }))
    .filter((row): row is { watch: WatchHorse; horse: CommentatorHorse } => row.horse != null)
    .sort((a, b) => a.watch.number - b.watch.number);
}

function watchTag(horse: CommentatorHorse, superWatch: boolean) {
  return superWatch ? `超注目・${horse.style}` : horse.style;
}

/** 位置率がこれ以上前へ動いた区間を、仕掛けにする。16頭なら約2頭分 */
const MOVE_MIN = 0.12;

type MoveSpot = "early" | "c4" | "stretch";

/**
 * 前進が見える区間があれば、そこを使う。
 * 無ければ脚質。逃は序盤、先と差は4角、追は直線。
 * 通過が無い馬は言わない。
 */
export function moveSpot(horse: Pick<CommentatorHorse, "style" | "passUnknown" | "corner3Rate" | "corner4Rate" | "stretchGainM">): MoveSpot | null {
  if (horse.passUnknown) return null;
  const cornerUp =
    horse.corner3Rate != null && horse.corner4Rate != null ? horse.corner3Rate - horse.corner4Rate : null;
  const stretchUp = horse.stretchGainM != null ? horse.stretchGainM / SPAN_M : null;
  const corner = cornerUp != null && cornerUp >= MOVE_MIN ? cornerUp : 0;
  const stretch = stretchUp != null && stretchUp >= MOVE_MIN ? stretchUp : 0;
  if (corner > 0 || stretch > 0) return corner > stretch ? "c4" : "stretch";
  if (horse.style === "逃") return "early";
  if (horse.style === "追") return "stretch";
  if (horse.style === "先" || horse.style === "差") return "c4";
  return null;
}

/** このコースの局面 id。直線の仕掛けは、坂があれば坂、無ければ直線 */
export function movePhaseId(horse: Pick<CommentatorHorse, "style" | "passUnknown" | "corner3Rate" | "corner4Rate" | "stretchGainM">, phases: { id: string }[]) {
  const spot = moveSpot(horse);
  if (!spot) return null;
  const ids = phases.map((phase) => phase.id);
  const has = (id: string) => ids.includes(id);
  if (spot === "c4") return has("c4") ? "c4" : null;
  if (spot === "stretch") {
    if (has("hill")) return "hill";
    if (has("straight")) return "straight";
    return null;
  }
  const early = ids.find((id) => id !== "start" && id !== "goal" && id !== "c3" && id !== "c4" && id !== "hill" && id !== "straight");
  if (early) return early;
  if (has("c3")) return "c3";
  return null;
}

function unknownNote(rows: { horse: CommentatorHorse }[]) {
  const unknown = rows.filter((row) => row.horse.passUnknown).map((row) => row.horse);
  if (!unknown.length) return "";
  if (unknown.length === rows.length) return "通過が無いから、馬身は出していないよ。";
  return `${joinJa(unknown.map((horse) => `${horse.number}番`))}は通過が無いから、馬身は出していないよ。`;
}

function kickLine(rows: { horse: CommentatorHorse }[], phaseId: string, phases: { id: string }[]) {
  const here = rows.filter((row) => movePhaseId(row.horse, phases) === phaseId).map((row) => row.horse);
  if (!here.length) return "";
  const who = joinJa(here.map((horse) => `${horse.number}番${horse.name}`));
  if (here.length === 1) return `注目馬の${who}は仕掛けるタイミングならここだよ。`;
  return `注目馬の${who}は、仕掛けるタイミングならここだよ。`;
}

/** 注目馬がいるときだけ。発走前は名前、発走後はその位置。着順の予想にはしない */
export function watchMention(
  watches: WatchHorse[],
  field: CommentatorHorse[],
  released: boolean,
  phaseId = "",
  phases: { id: string }[] = [],
) {
  const rows = watchRows(watches, field);
  if (!rows.length) return null;
  if (!released) {
    const names = rows.map(
      (row) => `${row.horse.number}番${row.horse.name}（${watchTag(row.horse, row.watch.superWatch === true)}）`,
    );
    const note = phaseId === "start" ? unknownNote(rows) : "";
    return `注目馬は${joinJa(names)}だよ。${note}`;
  }
  const bits = rows
    .filter((row) => !row.horse.passUnknown)
    .map((row) => {
      const who = `${row.horse.number}番${row.horse.name}${row.watch.superWatch ? "（超注目）" : ""}`;
      if (row.horse.behindM < 0.6) return `${who}はいま先頭だよ`;
      return `${who}は${spokenGap(row.horse.behindM)}だよ`;
    });
  const position = !bits.length ? "" : bits.length === 1 ? `注目馬の${bits[0]}。` : `注目馬は、${bits.join("、")}。`;
  const kick = kickLine(rows, phaseId, phases);
  const text = `${position}${kick}`;
  return text.length ? text : null;
}

/** 枠が解けたあと、通過がある馬だけ。通過が無い馬の馬身は言わない */
export function liveOrderLine(field: CommentatorHorse[], released: boolean) {
  if (!released) return null;
  const known = field.filter((horse) => !horse.passUnknown);
  const lead = known[0];
  if (!lead) return null;
  const chase = known[1];
  const leadText = `いま先頭は${horseName(lead)}だよ。`;
  if (!chase) return leadText;
  if (chase.behindM < 0.6) return `${leadText}2番手の${horseName(chase)}とは、ほぼ並んでいるよ。`;
  return `${leadText}2番手の${horseName(chase)}は、${spokenGap(chase.behindM)}だね。`;
}
