import { HitCatalogBoard } from "@/components/HitCatalogBoard";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getHitCatalog, getHitConditions } from "@/domain/hitCatalog";

export default function HitsPage() {
  const catalog = getHitCatalog();
  const conditions = getHitConditions();

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-4 py-8 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            HIT LEDGER
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl md:text-5xl">的中帳</h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            設定ゲート以上の券種的中（払戻）を溜めます。ここに載っているのはすべて払戻が出た買い目です。捕捉は「当たったか」ではなく、当日の候補にその買い目が入っていたかです。本体は単勝〜馬単を券種別に、3連複・3連単は研究所レーンで見ます。成績日記の購入記録とは別です。
          </p>
          <div className="mt-10">
            <HitCatalogBoard catalog={catalog} conditions={conditions} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
