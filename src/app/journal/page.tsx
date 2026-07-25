import { JournalPanel } from "@/components/JournalPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function JournalPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-6 py-14 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            JOURNAL
          </p>
          <h1 className="mt-2 text-3xl font-bold text-ink md:text-5xl">成績日記</h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            自分の購入と参考予想家の買い目を記録し、回収率を集計します。選別スコアの計算には使いません。
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
