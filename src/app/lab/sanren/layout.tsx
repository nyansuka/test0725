import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SanrenLabNav } from "@/components/SanrenLabNav";

export default function SanrenLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-4 py-12 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            SANREN LAB
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl md:text-5xl">
            3連系研究所
          </h1>
          <p className="mt-3 max-w-2xl text-ink/70">
            3連複と3連単を別レーンで選別します。本体の注目穴ボードとは独立した研究所面です。
          </p>
          <div className="mt-8">
            <SanrenLabNav />
          </div>
          <div className="mt-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
