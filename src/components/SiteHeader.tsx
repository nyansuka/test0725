export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-8">
        <a
          href="#top"
          className="font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.18em] text-sand md:text-xl"
        >
          UMANOTE
        </a>
        <nav className="flex items-center gap-6 text-sm text-sand/80">
          <a href="#featured" className="transition hover:text-sand">
            本日の本命
          </a>
          <a href="#races" className="hidden transition hover:text-sand sm:inline">
            レース一覧
          </a>
          <a href="#method" className="hidden transition hover:text-sand sm:inline">
            予想の見方
          </a>
        </nav>
      </div>
    </header>
  );
}
