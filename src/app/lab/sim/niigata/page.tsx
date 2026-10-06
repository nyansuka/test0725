import type { Metadata } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { NiigataSimLab } from "@/components/sim/NiigataSimLab";

export const metadata: Metadata = {
  title: "新潟の距離 | レースサンプル",
  robots: { index: false, follow: false },
};

/**
 * ローカル確認用。メインナビには出さない。本番へは push しない。
 * 平地のみ。障害コースは入れていない。
 */
export default function NiigataSimSamplePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white px-4 py-8 sm:px-6 md:px-8 md:py-12">
        <div className="mx-auto max-w-6xl">
          <NiigataSimLab />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
