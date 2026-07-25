import { snapshotMeta } from "@/data/races";

export function SiteFooter() {
  const fetched = snapshotMeta.fetchedAt
    ? new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(snapshotMeta.fetchedAt))
    : "—";

  return (
    <footer className="bg-ink px-6 py-10 text-sand/70 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.16em] text-sand">
          UMANOTE
        </p>
        <p className="max-w-xl text-sm leading-relaxed">
          JRA高配当候補の選別デモ · 公開Webデータ（{snapshotMeta.raceDate} / {snapshotMeta.raceCount}R ·
          取得 {fetched}）を反映 · オッズは主催者発表と照合してください · 的中保証はありません
        </p>
      </div>
    </footer>
  );
}
