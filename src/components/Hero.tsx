import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section
      id="top"
      className="relative h-[min(100svh,40rem)] min-h-[28rem] overflow-hidden bg-[#1d2b4a] text-sand sm:h-[min(100svh,44rem)] md:h-[min(100svh,48rem)]"
    >
      <Image
        src="/brand/hero-top.png"
        alt="駆ける競走馬と騎手のシルエット"
        fill
        priority
        className="object-cover object-[center_42%]"
        sizes="100vw"
      />
      <div className="hero-grain absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1d2b4a]/90 via-[#1d2b4a]/35 to-[#1d2b4a]/20"
      />

      <div className="hero-copy relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-10 pt-24 sm:px-6 md:px-8 md:pb-14">
        <div className="animate-rise flex max-w-full items-center gap-3 sm:gap-4">
          <Image
            src="/brand/mark.png"
            alt=""
            width={72}
            height={72}
            className="h-10 w-10 shrink-0 drop-shadow-md sm:h-12 sm:w-12 md:h-14 md:w-14"
            priority
            aria-hidden
          />
          <p className="font-[family-name:var(--font-display)] text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold leading-none tracking-[0.12em] text-sand">
            UMANOTE
          </p>
        </div>
        <h1 className="animate-rise-delay-1 mt-4 max-w-xl font-[family-name:var(--font-jp)] text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-snug text-sand">
          高配当候補を、短時間で見極める。
        </h1>
        <p className="animate-rise-delay-2 mt-3 max-w-md text-sm leading-relaxed text-sand/80 sm:text-base">
          JRA全券種のオッズゲートと複勝圏スコアで、穴になりうる買い目を選別します。
        </p>
        <div className="animate-rise-delay-3 mt-6 flex flex-wrap items-center gap-3 sm:mt-7 sm:gap-4">
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
