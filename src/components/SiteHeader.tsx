import Link from "next/link";

const links = [
  { href: "/longshots", label: "注目穴" },
  { href: "/races", label: "レース" },
  { href: "/journal", label: "成績日記" },
  { href: "/method", label: "見方" },
  { href: "/settings", label: "設定" },
];

type Props = {
  variant?: "overlay" | "solid";
};

export function SiteHeader({ variant = "solid" }: Props) {
  const overlay = variant === "overlay";

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-20"
          : "border-b border-ink/10 bg-sand/95 backdrop-blur"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 md:px-8">
        <Link
          href="/"
          className={`font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.18em] md:text-xl ${
            overlay ? "text-sand" : "text-turf"
          }`}
        >
          UMANOTE
        </Link>
        <nav
          className={`flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm ${
            overlay ? "text-sand/80" : "text-ink/70"
          }`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`transition ${overlay ? "hover:text-sand" : "hover:text-ink"}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
