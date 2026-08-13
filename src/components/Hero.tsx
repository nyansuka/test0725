import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section
      id="top"
      className="relative h-[min(100svh,28rem)] min-h-[20rem] overflow-hidden bg-[#1d2b4a] text-sand sm:h-[min(100svh,32rem)] md:h-[min(100svh,36rem)]"
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

      <div className="hero-copy relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-end px-4 pb-8 pt-20 sm:px-6 md:px-8 md:pb-10">
        <div className="animate-rise flex max-w-full items-center gap-3 sm:gap-4">
          <Image
            src="/brand/mark.png"
            alt=""
            width={72}
            height={72}
            className="h-9 w-9 shrink-0 drop-shadow-md sm:h-11 sm:w-11"
            priority
            aria-hidden
          />
          <p className="font-[family-name:var(--font-display)] text-[clamp(1.75rem,5vw,3.25rem)] font-extrabold leading-none tracking-[0.12em] text-sand">
            UMANOTE
          </p>
        </div>
        <h1 className="animate-rise-delay-1 mt-3 max-w-xl font-[family-name:var(--font-jp)] text-[clamp(1.1rem,2.2vw,1.5rem)] font-medium leading-snug text-sand">
          高配当候補を、短時間で見極める。
        </h1>
        <p className="animate-rise-delay-2 mt-2 max-w-md text-sm leading-relaxed text-sand/80">
          JRA全券種のオッズゲートと複勝圏スコアで、穴になりうる買い目を選別します。
        </p>
        <div className="animate-rise-delay-3 mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/longshots"
            className="inline-flex items-center bg-signal px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-signal-soft"
          >
            注目穴を見る
          </Link>
          <Link
            href="/races"
            className="inline-flex items-center border border-sand/40 px-5 py-2.5 text-sm text-sand transition hover:border-sand hover:bg-sand/10"
          >
            レース一覧
          </Link>
          <Link
            href="/lab/sanren"
            className="inline-flex items-center px-2 py-2.5 text-sm text-sand/80 underline-offset-4 transition hover:text-sand hover:underline"
          >
            3連系研究所
          </Link>
        </div>
      </div>
    </section>
  );
}
