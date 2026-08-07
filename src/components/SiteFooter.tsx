"use client";

import Image from "next/image";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";

export function SiteFooter() {
  const { fetchedAt, liveRaceDate, races, refreshing } = useRaceCatalog();
  const liveCount = races.filter((r) => r.raceDate === liveRaceDate).length;
  const resultCount = races.filter((r) => r.raceDate === liveRaceDate && r.result).length;
  const fetched = fetchedAt
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(fetchedAt))
    : "—";

  return (
    <footer className="bg-ink px-4 py-10 text-sand/70 sm:px-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.16em] text-sand">
          <Image
            src="/brand/mark.png"
            alt=""
            width={28}
            height={28}
            className="h-6 w-6"
            aria-hidden
          />
          UMANOTE
        </p>
        <p className="max-w-xl text-sm leading-relaxed">
          JRA高配当候補の選別デモ · 公開Webデータ（{liveRaceDate} / {liveCount}R · 結果{" "}
          {resultCount}R · 取得 {fetched}
          {refreshing ? " · 更新中" : ""}）· オッズ・結果は主催者発表と照合してください ·
          的中保証はありません
        </p>
      </div>
    </footer>
  );
}
