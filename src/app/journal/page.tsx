import { JournalPanel } from "@/components/JournalPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function JournalPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-4 py-12 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            JOURNAL
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl md:text-5xl">成績日記</h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            終了レースの期待度ランク別的中・回収（設定のオッズ閾値・最低スコアに連動）、注目穴の的中率、自分の購入・参考予想家の買い目を記録します。データは Neon
            PostgreSQL に保存します（接続できない場合のみブラウザに一時保存）。選別スコアの計算には使いません。
          </p>
          <div className="mt-10">
            <JournalPanel />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
