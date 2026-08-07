"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { RaceDayBar } from "@/components/RaceDayBar";

const links = [
  { href: "/longshots", label: "注目穴" },
  { href: "/races", label: "レース" },
  { href: "/journal", label: "成績日記" },
  { href: "/method", label: "予想の見方" },
  { href: "/settings", label: "設定" },
];

type Props = {
  variant?: "overlay" | "solid";
  /** 開催日バーを出す（デフォルト true） */
  showRaceDayBar?: boolean;
};

export function SiteHeader({ variant = "solid", showRaceDayBar = true }: Props) {
  const overlay = variant === "overlay";
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header
        className={
          overlay
            ? "absolute inset-x-0 top-0 z-20"
            : "relative z-30 border-b border-ink/10 bg-white/95 backdrop-blur"
        }
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 md:px-8 md:py-5">
          <Link
            href="/"
            className={`inline-flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-bold tracking-[0.18em] md:text-xl ${
              overlay ? "text-sand" : "text-turf"
            }`}
          >
            <Image
              src="/brand/mark.png"
              alt=""
              width={36}
              height={36}
              className="h-7 w-7 md:h-8 md:w-8"
              aria-hidden
              priority
            />
            UMANOTE
          </Link>

          <nav
            className={`hidden items-center gap-x-5 text-sm md:flex ${
              overlay ? "text-sand/80" : "text-ink/70"
            }`}
            aria-label="メイン"
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

          <button
            type="button"
            className={`inline-flex h-11 w-11 items-center justify-center md:hidden ${
              overlay ? "text-sand" : "text-ink"
            }`}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? "メニューを閉じる" : "メニューを開く"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">{open ? "閉じる" : "メニュー"}</span>
            <span className="relative block h-3.5 w-5" aria-hidden>
              <span
                className={`absolute left-0 top-0 block h-0.5 w-5 origin-center transition ${
                  overlay ? "bg-sand" : "bg-ink"
                } ${open ? "translate-y-[7px] rotate-45" : ""}`}
              />
              <span
                className={`absolute left-0 top-[7px] block h-0.5 w-5 transition ${
                  overlay ? "bg-sand" : "bg-ink"
                } ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute left-0 top-[14px] block h-0.5 w-5 origin-center transition ${
                  overlay ? "bg-sand" : "bg-ink"
                } ${open ? "-translate-y-[7px] -rotate-45" : ""}`}
              />
            </span>
          </button>
        </div>

        <div
          id={menuId}
          className={`border-t md:hidden ${
            overlay
              ? "border-sand/15 bg-turf-deep/95 text-sand backdrop-blur"
              : "border-ink/10 bg-white text-ink"
          } ${open ? "block" : "hidden"}`}
        >
          <nav className="mx-auto flex max-w-6xl flex-col px-4 py-2 sm:px-6" aria-label="モバイル">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`border-b py-3.5 text-base ${
                  overlay
                    ? "border-sand/10 text-sand/90 hover:text-sand"
                    : "border-ink/10 text-ink/80 hover:text-ink"
                } ${pathname === link.href || pathname.startsWith(`${link.href}/`) ? "font-semibold" : ""}`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {showRaceDayBar && !overlay ? <RaceDayBar /> : null}
    </>
  );
}
