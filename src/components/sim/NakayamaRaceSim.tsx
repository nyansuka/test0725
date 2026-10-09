"use client";

import { useEffect, useState } from "react";
import { NakayamaTurfSim } from "@/components/sim/NakayamaTurfSim";
import { TurfCourseSim } from "@/components/sim/TurfCourseSim";
import { flatCourseView } from "@/domain/sim/flatCourse";
import { heavyGoingKeepsFront, isHeavyGoing } from "@/domain/sim/heavyFront";
import type { SimHorse } from "@/domain/sim/nakayamaTurf1200";
import { flatSimId } from "@/domain/sim/flatSimCatalog";
import { isPlayedTurfCourse, turfCourseView } from "@/domain/sim/turfOneTurnCourse";
import type { Race } from "@/domain/types";

type Field = {
  title: string;
  raceDate: string;
  raceNumber: number;
  startTime: string;
  horses: SimHorse[];
  withoutPass: string[];
};

export function NakayamaRaceSim({ race }: { race: Race }) {
  const courseId = flatSimId(race);
  const played = courseId && isPlayedTurfCourse(courseId) ? turfCourseView(courseId) : null;
  const flat = courseId && !played && courseId !== "nakayama-turf-1200" ? flatCourseView(courseId) : null;
  const course = played ?? flat;
  const courseName = course?.titleText ?? "中山芝1200";
  const facts = course?.facts ?? ["右回り・外回り", "2角奥スタート", "3角まで約440m・下り", "直線310m・急坂"];
  const surface = race.track === "ダート" ? "ダート" : "芝";
  const [field, setField] = useState<Field | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancel = false;
    setField(null);
    setError("");
    fetch(`/lab/sim/field?id=${encodeURIComponent(race.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("missing");
        return (await res.json()) as Field;
      })
      .then((data) => {
        if (!cancel) setField(data);
      })
      .catch(() => {
        if (!cancel) setError("走行を組めませんでした。");
      });
    return () => {
      cancel = true;
    };
  }, [race.id]);

  if (!courseId) return null;
  const squeeze = isHeavyGoing(race.condition) && heavyGoingKeepsFront(race.venue, race.track, race.distance);

  return (
    <section className="mt-10 border-t border-ink/10 pt-8">
      <h2 className="text-sm font-semibold text-ink">走行</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
        {race.raceDate} · {race.raceNumber}R · {race.title} · {courseName}。枠と、発走前の直近5走（{surface}）の通過位置で並べ、直線では最後の通過から着順まで詰めた幅を足しています。調教は見ていません。着順の予想ではありません。
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/55">
        {facts.map((fact) => (
          <div key={fact}>{fact}</div>
        ))}
      </dl>
      {error ? <p className="mt-4 text-sm text-ink/60">{error}</p> : null}
      {!field && !error ? <p className="mt-4 text-sm text-ink/50">走行を組んでいます。</p> : null}
      {field && field.withoutPass.length === field.horses.length ? (
          <p className="mt-4 text-sm text-ink/60">発走前の{surface}の通過が取れないので、並びは作っていません。</p>
      ) : null}
      {field && field.withoutPass.length < field.horses.length ? (
        <>
          {field.withoutPass.length ? (
            <p className="mt-3 text-xs leading-relaxed text-ink/45">
              {surface}の通過が無い馬は、通過がある馬の後ろにまとめて、馬身は出していません（{field.withoutPass.join("、")}）。
            </p>
          ) : null}
          <div className="mt-4">
            {courseId === "nakayama-turf-1200" ? (
              <NakayamaTurfSim key={race.id} horses={squeeze ? field.horses.map((horse) => ({ ...horse, squeezeStraight: true })) : field.horses} />
            ) : (
              <TurfCourseSim key={race.id} courseId={courseId} horses={squeeze ? field.horses.map((horse) => ({ ...horse, squeezeStraight: true })) : field.horses} />
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
