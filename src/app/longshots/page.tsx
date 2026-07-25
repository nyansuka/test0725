import { LongshotsBoard } from "@/components/LongshotsBoard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { races } from "@/data/races";

export default function LongshotsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-6 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            LONGSHOT BOARD
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink md:text-5xl">注目穴ボード</h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            当日 JRA サンプルの全券種から、オッズ閾値以上かつ複勝圏スコア基準を満たす候補を一覧します。
          </p>
          <div className="mt-10">
            <LongshotsBoard races={races} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
