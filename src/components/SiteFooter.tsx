export function SiteFooter() {
  return (
    <footer className="bg-ink px-6 py-10 text-sand/70 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.16em] text-sand">
          UMANOTE
        </p>
        <p className="text-sm">
          JRA高配当候補の選別デモ · Next.js + Docker · 実馬券の的中保証はありません
        </p>
      </div>
    </footer>
  );
}
