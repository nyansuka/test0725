"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { BRACKET_COLOR, lengthsLabel, MARKER_R, TRACK_STROKE } from "@/domain/sim/nakayamaTurf1200Play";
import type { SimHorse } from "@/domain/sim/nakayamaTurf1200Script";
import { RELEASE_M } from "@/domain/sim/turfCoursePlay";
import { turfCourseView, type TurfCourseId } from "@/domain/sim/turfOneTurnCourse";

const DURATION_MS = 22000;

function px(n: number) {
  return Math.round(n * 10) / 10;
}

export function TurfCourseSim({ courseId, horses }: { courseId: TurfCourseId; horses: SimHorse[] }) {
  const course = turfCourseView(courseId);
  const run = useMemo(() => course.play(horses), [course, horses]);
  const [meter, setMeter] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState<number>(run.focusNumber);
  const [mounted, setMounted] = useState(false);
  const sliderId = useId();

  useEffect(() => {
    setMounted(true);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      setMeter((current) => {
        const next = current + (course.raceMeters * dt * speed) / DURATION_MS;
        if (next >= course.raceMeters) {
          setPlaying(false);
          return course.raceMeters;
        }
        return next;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, course.raceMeters]);

  const field = run.fieldAt(meter);
  const phase = run.phaseAt(meter);
  const selectedRow = field.find((row) => row.horse.number === selected) ?? field[0];
  if (!selectedRow) return null;
  const finish = course.pointAt(course.raceMeters);
  const start = course.pointAt(0);

  function jump(m: number) {
    setMeter(m);
    setPlaying(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="rounded-lg border border-ink/10 bg-[#e7f3ec]">
          {mounted ? (
            <svg
              viewBox={course.viewBox}
              width="100%"
              height="auto"
              className="block h-auto w-full max-w-full"
              role="img"
              aria-label={course.aria}
            >
              <path d={course.idle} fill="none" stroke="#9bb8a8" strokeWidth="48" strokeLinecap="round" />
              <path d={course.gate} fill="none" stroke="#2f6f4e" strokeWidth={TRACK_STROKE} strokeLinecap="round" />
              <path d={course.track} fill="none" stroke="#2f6f4e" strokeWidth={TRACK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
              <path d={course.track} fill="none" stroke="#d8efe2" strokeWidth="2" strokeDasharray="5 7" />
              <path d={course.hill} fill="none" stroke="#c2410c" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
              <text x={course.title.x} y={course.title.y} textAnchor="middle" fill="#1f5c45" fontSize="15" fontWeight="700">
                {course.titleText}
              </text>
              <text x={course.title.x} y={course.title.y + 22} textAnchor="middle" fill="#1f5c45" fontSize="12" opacity="0.8">
                {course.subtitle}
              </text>
              <text x={course.note.x} y={course.note.y} textAnchor="middle" fill="#5f7a6c" fontSize="11">
                {course.noteText}
              </text>
              {course.labels.map((label) => {
                const p = course.markerAt(label.m, label.out);
                return (
                  <text key={label.text} x={p.x} y={p.y} textAnchor="middle" fill="#141210" fontSize="12" fontWeight="700">
                    {label.text}
                  </text>
                );
              })}
              <line
                x1={px(start.x + start.ix * (TRACK_STROKE / 2))}
                y1={px(start.y + start.iy * (TRACK_STROKE / 2))}
                x2={px(start.x - start.ix * (TRACK_STROKE / 2))}
                y2={px(start.y - start.iy * (TRACK_STROKE / 2))}
                stroke="#ffffff"
                strokeWidth="3"
              />
              <line
                x1={px(finish.x + finish.ix * (TRACK_STROKE / 2))}
                y1={px(finish.y + finish.iy * (TRACK_STROKE / 2))}
                x2={px(finish.x - finish.ix * (TRACK_STROKE / 2))}
                y2={px(finish.y - finish.iy * (TRACK_STROKE / 2))}
                stroke="#ffffff"
                strokeWidth="3"
              />
              {[...field]
                .sort((a, b) => a.along - b.along || a.horse.number - b.horse.number)
                .map((row) => {
                  const color = BRACKET_COLOR[row.horse.bracket] ?? BRACKET_COLOR[1];
                  const active = row.horse.number === selected;
                  return (
                    <g
                      key={row.horse.number}
                      transform={`translate(${row.x.toFixed(1)} ${row.y.toFixed(1)})`}
                      onClick={() => setSelected(row.horse.number)}
                      style={{ cursor: "pointer" }}
                    >
                      <title>
                        {row.horse.number} {row.horse.name} {row.horse.style}
                      </title>
                      {active ? <circle r={MARKER_R + 2} fill="none" stroke="#d97706" strokeWidth="2" /> : null}
                      <circle r={MARKER_R} fill={color.fill} stroke="#ffffff" strokeWidth="1.5" />
                      <text textAnchor="middle" y="3.5" fill={color.text} fontSize="10" fontWeight="700">
                        {row.horse.number}
                      </text>
                    </g>
                  );
                })}
            </svg>
          ) : (
            <div className="aspect-[2/1] w-full" />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (meter >= course.raceMeters) setMeter(0);
              setPlaying((value) => !value);
            }}
            className="rounded-md bg-turf px-4 py-2 text-sm font-bold text-sand"
          >
            {playing ? "停止" : meter >= course.raceMeters ? "もう一度" : "再生"}
          </button>
          <button type="button" onClick={() => jump(0)} className="rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/80">
            最初から
          </button>
          <button
            type="button"
            onClick={() => setSpeed((value) => (value === 1 ? 2 : 1))}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/80"
          >
            {speed === 1 ? "速度 1x" : "速度 2x"}
          </button>
          {run.phases.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jump(item.m)}
              className={`rounded-md px-3 py-2 text-sm ${phase.id === item.id ? "bg-ink text-sand" : "border border-ink/15 text-ink/75"}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label htmlFor={sliderId} className="mt-3 block text-xs text-ink/50">
          先頭の位置 {Math.round(meter)}m / {course.raceMeters}m
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={course.raceMeters}
          value={meter}
          onChange={(event) => jump(Number(event.target.value))}
          className="mt-1 w-full"
        />

        <div className="mt-4 rounded-md border border-ink/10 bg-white px-4 py-3">
          <p className="text-xs tracking-wider text-ink/45">{phase.label}</p>
          <p className="mt-1 text-sm font-bold text-ink">{phase.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink/70">{phase.body}</p>
        </div>
      </div>

      <aside className="lg:pt-1">
        <p className="text-xs tracking-wider text-ink/45">想定の並び</p>
        <p className="mt-1 text-sm text-ink/60">
          {meter < RELEASE_M
            ? `${selectedRow.horse.number}番 ${selectedRow.horse.name}（${selectedRow.horse.style}）· 枠なり`
            : `${selectedRow.rank}番手 ${selectedRow.horse.name}（${selectedRow.horse.style}）· ${lengthsLabel(selectedRow.behindM)}`}
        </p>
        <ol className="mt-3 divide-y divide-ink/10 border-y border-ink/10">
          {field.map((row) => {
            const color = BRACKET_COLOR[row.horse.bracket] ?? BRACKET_COLOR[1];
            const active = row.horse.number === selected;
            return (
              <li key={row.horse.number}>
                <button
                  type="button"
                  onClick={() => setSelected(row.horse.number)}
                  className={`flex w-full items-center gap-2 py-2 text-left text-sm ${active ? "bg-signal/10" : ""}`}
                >
                  <span className="w-5 shrink-0 text-right tabular-nums text-ink/45">{row.rank}</span>
                  <span
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: color.fill, color: color.text }}
                  >
                    {row.horse.number}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.horse.name}</span>
                  <span className="shrink-0 text-ink/55">{row.horse.style}</span>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink/50">
                    {meter < RELEASE_M ? "枠" : lengthsLabel(row.behindM)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-ink/45">
          馬身は論理値。脚質は発走前の直近5走。着順の予想ではない。枠色はJRAの枠番。
        </p>
      </aside>
    </div>
  );
}
