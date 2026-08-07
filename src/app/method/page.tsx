import { Method } from "@/components/Method";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function MethodPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="bg-sand px-4 py-12 sm:px-6 md:px-8 md:py-16">
          <div className="mx-auto max-w-6xl">
            <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
              METHOD
            </p>
            <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl md:text-5xl">予想の見方</h1>
            <p className="mt-3 max-w-2xl text-ink/70">
              スコア実装は差し替え可能です。人気乖離・近況は導出済み。コース／展開／馬場などは当面ルール＋仮値です。
            </p>
          </div>
        </div>
        <Method />
      </main>
      <SiteFooter />
    </>
  );
}
