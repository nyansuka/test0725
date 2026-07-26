import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden bg-[#1d2b4a] text-sand">
      <Image
        src="/brand/hero-top.png"
        alt="駆ける競走馬と騎手のシルエット"
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />
      <div className="hero-grain absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1d2b4a]/90 via-[#1d2b4a]/35 to-[#1d2b4a]/20"
      />
      <div
        aria-hidden
        className="animate-rail absolute bottom-[22%] left-[-10%] h-px w-[120%] bg-gradient-to-r from-transparent via-sand/50 to-transparent"
      />
      <div
        aria-hidden
        className="animate-rail absolute bottom-[20%] left-[-8%] h-px w-[120%] bg-gradient-to-r from-transparent via-signal-soft/40 to-transparent [animation-delay:1.2s]"
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 md:px-8 md:pb-20">
        <div className="animate-rise flex items-center gap-3 sm:gap-4">
          <Image
            src="/brand/mark.png"
            alt=""
            width={72}
            height={72}
            className="h-12 w-12 drop-shadow-md sm:h-16 sm:w-16"
            priority
            aria-hidden
          />
          <p className="font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[0.14em] text-sand sm:text-7xl md:text-8xl">
            UMANOTE
          </p>
        </div>
        <h1 className="animate-rise-delay-1 mt-5 max-w-xl font-[family-name:var(--font-jp)] text-2xl font-medium leading-snug text-sand sm:text-3xl">
          高配当候補を、短時間で見極める。
        </h1>
        <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-sand/80">
          JRA全券種のオッズゲートと複勝圏スコアで、穴になりうる買い目を選別します。
        </p>
        <div className="animate-rise-delay-3 mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/longshots"
            className="inline-flex items-center bg-signal px-6 py-3 text-sm font-medium text-ink transition hover:bg-signal-soft"
          >
            注目穴を見る
          </Link>
          <Link
            href="/races"
            className="inline-flex items-center border border-sand/40 px-6 py-3 text-sm text-sand transition hover:border-sand hover:bg-sand/10"
          >
            レース一覧
          </Link>
        </div>
      </div>
    </section>
  );
}
