"use client";

import { useState } from "react";
import Link from "next/link";
import { TokyoTemplateMap } from "@/components/sim/TokyoTemplateMap";
import { TOKYO_TEMPLATES, presentTokyo, tokyoRunPhrase, tokyoTemplate, type SimTrack } from "@/domain/sim/tokyoCourse";

const TRACKS: SimTrack[] = ["芝", "ダート"];

export function TokyoSimLab() {
  const [id, setId] = useState("turf-1600");
  const template = tokyoTemplate(id);
  const map = presentTokyo(template.id);
  const straight = template.track === "ダート" ? "501.6m" : "525.9m";

  return (
    <>
      <p className="text-xs font-bold tracking-[0.16em] text-signal">LOCAL SAMPLE</p>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">東京の距離</h1>
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink/55">
        <Link href="/lab/sim" className="underline">
          中山の距離
        </Link>
        <Link href="/lab/sim/hanshin" className="underline">
          阪神の距離
        </Link>
        <Link href="/lab/sim/kyoto" className="underline">
          京都の距離
        </Link>
        <Link href="/lab/sim/sapporo" className="underline">
          札幌の距離
        </Link>
        <Link href="/lab/sim/hakodate" className="underline">
          函館の距離
        </Link>
        <Link href="/lab/sim/fukushima" className="underline">
          福島の距離
        </Link>
        <Link href="/lab/sim/niigata" className="underline">
          新潟の距離
        </Link>
        <Link href="/lab/sim/chukyo" className="underline">
          中京の距離
        </Link>
        <Link href="/lab/sim/kokura" className="underline">
          小倉の距離
        </Link>
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
        平地の芝とダート。障害は入れていない。Aコースの一周に合わせた模式図で、白い線が発走とゴール。濃い線がこの距離で使うところ。
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {TRACKS.map((track) => (
          <div key={track} className="flex flex-wrap items-center gap-2">
            <span className="w-12 shrink-0 text-xs font-bold tracking-wider text-ink/45">{track}</span>
            {TOKYO_TEMPLATES.filter((item) => item.track === track).map((item) => {
              const on = item.id === template.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setId(item.id)}
                  className={`rounded-md px-3 py-2 text-sm ${
                    on ? "bg-ink text-sand" : "border border-ink/15 text-ink/75"
                  }`}
                >
                  {item.meters}
                  <span className={`ml-1 text-[10px] ${on ? "text-sand/70" : "text-ink/40"}`}>{item.badge}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <TokyoTemplateMap map={map} />
          <p className="mt-3 text-xs leading-relaxed text-ink/45">
            左回り。芝と、内側のダート。オレンジは直線の坂（残り460mから300m、高低差約2m）。1800と2000はポケット、ダート1600は芝スタート。
          </p>
        </div>
        <aside>
          <p className="text-xs tracking-wider text-ink/45">
            {template.track}
            {template.meters} · {template.course}
          </p>
          <p className="mt-1 text-lg font-bold text-ink">{template.place}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink/70">{template.summary}</p>
          <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
            <div>直線{straight}</div>
            <div>{tokyoRunPhrase(template)}</div>
            <div>一周{Math.round(template.lap)}m</div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/70">
            {template.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
