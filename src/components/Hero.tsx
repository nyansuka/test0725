import Image from "next/image";

export function Hero() {
  return (
    <section id="top" className="relative min-h-[100svh] overflow-hidden bg-turf-deep text-sand">
      <Image
        src="https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&w=2400&q=80"
        alt="競馬場のコースを駆ける競走馬"
        fill
        priority
        className="object-cover object-[center_35%]"
        sizes="100vw"
      />
      <div className="hero-grain absolute inset-0" />
      <div
        aria-hidden
        className="animate-rail absolute bottom-[22%] left-[-10%] h-px w-[120%] bg-gradient-to-r from-transparent via-sand/50 to-transparent"
      />
      <div
        aria-hidden
        className="animate-rail absolute bottom-[20%] left-[-8%] h-px w-[120%] bg-gradient-to-r from-transparent via-signal-soft/40 to-transparent [animation-delay:1.2s]"
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-6 pb-16 pt-28 md:px-8 md:pb-20">
        <p className="animate-rise font-[family-name:var(--font-display)] text-5xl font-extrabold tracking-[0.14em] text-sand sm:text-7xl md:text-8xl">
          UMANOTE
        </p>
        <h1 className="animate-rise-delay-1 mt-5 max-w-xl font-[family-name:var(--font-jp)] text-2xl font-medium leading-snug text-sand sm:text-3xl">
          今日のレースを、短く鋭く読む。
        </h1>
        <p className="animate-rise-delay-2 mt-4 max-w-md text-base leading-relaxed text-sand/80">
          サンプルデータで動く競馬予想サイト。本命・対抗・穴候補を信頼度付きで一覧できます。
        </p>
        <div className="animate-rise-delay-3 mt-8 flex flex-wrap items-center gap-4">
          <a
            href="#featured"
            className="inline-flex items-center bg-signal px-6 py-3 text-sm font-medium text-ink transition hover:bg-signal-soft"
          >
            本日の本命を見る
          </a>
          <a
            href="#races"
            className="inline-flex items-center border border-sand/40 px-6 py-3 text-sm text-sand transition hover:border-sand hover:bg-sand/10"
          >
            全レース一覧
          </a>
        </div>
      </div>
    </section>
  );
}
