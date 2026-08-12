"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const lanes = [
  { href: "/lab/sanren", label: "ハブ", exact: true },
  { href: "/lab/sanren/trio", label: "3連複研究", exact: false },
  { href: "/lab/sanren/trifecta", label: "3連単研究", exact: false },
] as const;

export function SanrenLabNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="3連系研究所レーン"
      className="flex flex-wrap gap-2 border-b border-ink/10 pb-4"
    >
      {lanes.map((lane) => {
        const active = lane.exact
          ? pathname === lane.href
          : pathname === lane.href || pathname.startsWith(`${lane.href}/`);
        return (
          <Link
            key={lane.href}
            href={lane.href}
            className={`border px-3 py-1.5 text-sm transition ${
              active
                ? "border-turf bg-turf text-sand"
                : "border-ink/15 text-ink/70 hover:border-ink/40"
            }`}
          >
            {lane.label}
          </Link>
        );
      })}
    </nav>
  );
}
