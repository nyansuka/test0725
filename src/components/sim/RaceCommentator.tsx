import {
  commentatorMood,
  liveOrderLine,
  manekiFrame,
  preStartSpeech,
  racePoints,
  softenLast,
  watchMention,
  type CommentatorHorse,
  type ManekiFrame,
  type WatchHorse,
} from "@/domain/sim/commentator";
import type { SimPhase } from "@/domain/sim/nakayamaTurf1200Script";

type FieldRow = {
  horse: {
    number: number;
    name: string;
    style: string;
    passUnknown?: boolean;
    corner3Rate?: number | null;
    corner4Rate?: number | null;
    stretchGainM?: number | null;
  };
  behindM: number;
};

const FRAME_POSITION: Record<ManekiFrame, string> = {
  ki: "0% 0%",
  do: "100% 0%",
  ai: "0% 100%",
  raku: "100% 100%",
};

export function RaceCommentator({
  courseName,
  facts,
  phases,
  phase,
  field,
  released,
  watches = [],
}: {
  courseName: string;
  facts: string[];
  phases: SimPhase[];
  phase: SimPhase;
  field: FieldRow[];
  released: boolean;
  watches?: WatchHorse[];
}) {
  const beforeStart = !released;
  const mood = beforeStart ? "wait" : commentatorMood(phase.id);
  const mapped = field.map(
    (row): CommentatorHorse => ({
      number: row.horse.number,
      name: row.horse.name,
      style: row.horse.style,
      behindM: row.behindM,
      passUnknown: row.horse.passUnknown,
      corner3Rate: row.horse.corner3Rate,
      corner4Rate: row.horse.corner4Rate,
      stretchGainM: row.horse.stretchGainM,
    }),
  );
  const order = liveOrderLine(mapped, released);
  const watch = watchMention(watches, mapped, released, phase.id, phases);
  const title = beforeStart ? "コースと見どころ" : phase.title;
  const body = beforeStart ? preStartSpeech(courseName, facts, racePoints(phases)) : softenLast(phase.body);
  const label = beforeStart ? "スタート前" : phase.label;

  return (
    <div className="mt-4 flex items-start gap-3">
      <ManekiPortrait frame={manekiFrame(mood)} />
      <div className="relative min-w-0 flex-1 rounded-md border border-ink/10 bg-white px-4 py-3">
        <span
          aria-hidden
          className="absolute top-8 -left-1.5 h-3 w-3 rotate-45 border-b border-l border-ink/10 bg-white"
        />
        <p className="text-xs tracking-wider text-ink/45">
          まねき先生 · {label}
        </p>
        <p className="mt-1 text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-ink/70">{body}</p>
        {watch ? <p className="mt-2 text-sm leading-relaxed text-ink">{watch}</p> : null}
        {order ? <p className="mt-2 text-sm leading-relaxed text-ink">{order}</p> : null}
      </div>
    </div>
  );
}

function ManekiPortrait({ frame }: { frame: ManekiFrame }) {
  return (
    <div
      role="img"
      aria-label="まねき先生"
      className="h-[100px] w-[134px] shrink-0 rounded-lg border border-ink/10 bg-no-repeat"
      style={{
        backgroundImage: "url(/sim/neko.jpg?v=2)",
        backgroundSize: "200% 200%",
        backgroundPosition: FRAME_POSITION[frame],
      }}
    />
  );
}
