"use client";

import { useState } from "react";
import Link from "next/link";
import { NakayamaTurfSim } from "@/components/sim/NakayamaTurfSim";
import { NakayamaTemplateMap } from "@/components/sim/NakayamaTemplateMap";
import {
  NAKAYAMA_TEMPLATES,
  nakayamaRunPhrase,
  nakayamaTemplate,
  presentNakayama,
  type SimTrack,
} from "@/domain/sim/nakayamaCourse";

const TRACKS: SimTrack[] = ["芝", "ダート"];

export function NakayamaSimLab() {
  const [id, setId] = useState("turf-1200");
  const template = nakayamaTemplate(id);
  const map = presentNakayama(template.id);
  const straight = template.track === "ダート" ? "308m" : "310m";

  return (
    <>
      <p className="text-xs font-bold tracking-[0.16em] text-signal">LOCAL SAMPLE</p>
      <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">中山の距離</h1>
      <p className="mt-2 flex flex-wrap gap-x-4 text-sm text-ink/55">
        <Link href="/lab/sim/tokyo" className="underline">
          東京の距離
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
            {NAKAYAMA_TEMPLATES.filter((item) => item.track === track).map((item) => {
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
          <NakayamaTemplateMap map={map} />
          <p className="mt-3 text-xs leading-relaxed text-ink/45">
            芝の内と外、内側のダート。オレンジはゴール前の急坂（残り180mから70m）。右回り。
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
            <div>{nakayamaRunPhrase(template)}</div>
            <div>一周{Math.round(template.lap)}m</div>
          </dl>
          <ul className="mt-4 space-y-2 text-sm leading-relaxed text-ink/70">
            {template.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </aside>
      </div>

      {template.id === "turf-1200" ? (
        <section className="mt-12 border-t border-ink/10 pt-10">
          <h2 className="text-xl font-bold text-ink sm:text-2xl">勝浦特別</h2>
          <p className="mt-2 text-sm text-ink/60">2026-09-26 · 10R · 14:50 · 中山芝1200</p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
            このメンバーの枠と、発走前の直近5走（芝）の通過位置だけで並べています。調教は見ていません。馬場は重ですが、位置には反映していません。着順の予想ではありません。
          </p>
          <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
            <div>右回り・外回り</div>
            <div>2角奥スタート</div>
            <div>3角まで約440m・下り</div>
            <div>直線310m・急坂</div>
            <div>逃げ3頭で序盤は速い想定</div>
          </dl>
          <div className="mt-6">
            <NakayamaTurfSim />
          </div>
        </section>
      ) : null}
    </>
  );
}
