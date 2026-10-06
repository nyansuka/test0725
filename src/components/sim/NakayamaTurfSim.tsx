"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  BRACKET_COLOR,
  createTurf1200,
  lengthsLabel,
  MARKER_R,
  TRACK_STROKE,
} from "@/domain/sim/nakayamaTurf1200Play";
import {
  COURSE_NOTE,
  COURSE_TITLE,
  COURSE_VIEWBOX,
  RACE_METERS,
  coursePathD,
  gatePathD,
  hillPathD,
  markerAt,
  pointAt,
  unusedPathD,
} from "@/domain/sim/nakayamaTurf1200Path";
import { HORSES, type SimHorse } from "@/domain/sim/nakayamaTurf1200Script";

const DURATION_MS = 22000;

function px(n: number) {
  return Math.round(n * 10) / 10;
}

export function NakayamaTurfSim({ horses = HORSES }: { horses?: SimHorse[] }) {
  const run = useMemo(() => createTurf1200(horses), [horses]);
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
        const next = current + (RACE_METERS * dt * speed) / DURATION_MS;
        if (next >= RACE_METERS) {
          setPlaying(false);
          return RACE_METERS;
        }
        return next;
      });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed]);

  const field = run.fieldAt(meter);
  const phase = run.phaseAt(meter);
  const selectedRow = field.find((row) => row.horse.number === selected) ?? field[0];
  if (!selectedRow) return null;
  const track = coursePathD();
  const gate = gatePathD();
  const hill = hillPathD();
  const idle = unusedPathD();
  const finish = pointAt(RACE_METERS);
  const start = pointAt(0);
  const c3 = run.phases.find((item) => item.id === "c3")?.m ?? 440;
  const c4 = run.phases.find((item) => item.id === "c4")?.m ?? 700;
  const labels = [
    { m: 16, text: "2角奥", out: 58 },
    { m: 140, text: "下り", out: 58 },
    { m: c3, text: "3角", out: 58 },
    { m: c4, text: "4角", out: 58 },
    { m: 1075, text: "急坂", out: 58 },
    { m: 1200, text: "ゴール", out: 58 },
  ];

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
            viewBox={COURSE_VIEWBOX}
            width="100%"
            height="auto"
            className="block h-auto w-full max-w-full"
            role="img"
            aria-label="中山芝1200の想定走行。右回りの外回りを、2角奥から直線の急坂まで進む"
          >
            <path d={idle} fill="none" stroke="#9bb8a8" strokeWidth="48" strokeLinecap="round" />
            <path d={gate} fill="none" stroke="#2f6f4e" strokeWidth={TRACK_STROKE} strokeLinecap="round" />
            <path d={track} fill="none" stroke="#2f6f4e" strokeWidth={TRACK_STROKE} strokeLinecap="round" strokeLinejoin="round" />
            <path d={track} fill="none" stroke="#d8efe2" strokeWidth="2" strokeDasharray="5 7" />
            <path d={hill} fill="none" stroke="#c2410c" strokeWidth="10" strokeLinecap="round" opacity="0.9" />
            <text x={COURSE_TITLE.x} y={COURSE_TITLE.y} textAnchor="middle" fill="#1f5c45" fontSize="15" fontWeight="700">
              中山芝1200
            </text>
            <text x={COURSE_TITLE.x} y={COURSE_TITLE.y + 22} textAnchor="middle" fill="#1f5c45" fontSize="12" opacity="0.8">
              外回り・右回り
            </text>
            <text x={COURSE_NOTE.x} y={COURSE_NOTE.y} textAnchor="middle" fill="#5f7a6c" fontSize="11">
              1〜2角はこの距離では通らない
            </text>
            {labels.map((label) => {
              const p = markerAt(label.m, label.out);
              return (
                <text
                  key={label.text}
                  x={p.x}
                  y={p.y}
                  textAnchor="middle"
                  fill="#141210"
                  fontSize="12"
                  fontWeight="700"
                >
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
                  <text
                    textAnchor="middle"
                    y="3.5"
                    fill={color.text}
                    fontSize="10"
                    fontWeight="700"
                  >
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
              if (meter >= RACE_METERS) setMeter(0);
              setPlaying((value) => !value);
            }}
            className="rounded-md bg-turf px-4 py-2 text-sm font-bold text-sand"
          >
            {playing ? "停止" : meter >= RACE_METERS ? "もう一度" : "再生"}
          </button>
          <button
            type="button"
            onClick={() => jump(0)}
            className="rounded-md border border-ink/15 px-3 py-2 text-sm text-ink/80"
          >
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
              className={`rounded-md px-3 py-2 text-sm ${
                phase.id === item.id
                  ? "bg-ink text-sand"
                  : "border border-ink/15 text-ink/75"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label htmlFor={sliderId} className="mt-3 block text-xs text-ink/50">
          先頭の位置 {Math.round(meter)}m / {RACE_METERS}m
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={RACE_METERS}
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
          {meter < 140
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
                  className={`flex w-full items-center gap-2 py-2 text-left text-sm ${
                    active ? "bg-signal/10" : ""
                  }`}
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
                    {meter < 140 ? "枠" : lengthsLabel(row.behindM)}
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
