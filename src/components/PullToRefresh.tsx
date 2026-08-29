"use client";

import { useEffect, useRef } from "react";
import { CATALOG_FORCE_REFRESH_KEY } from "@/components/RaceCatalogProvider";

const THRESHOLD_PX = 60;
const ACTIVATE_PX = 6;
const MAX_INDICATOR_PX = 72;
const RESISTANCE = 0.45;
const TOP_SLACK_PX = 24;

type Phase = "idle" | "pull" | "armed" | "busy";

/**
 * ページ先頭から下に引くと再読み込みする。
 * touchmove は最初から非 passive で取り、iOS がジェスチャーを奪う前に preventDefault する。
 */
export function PullToRefresh() {
  const rootRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const icon = iconRef.current;
    const label = labelRef.current;
    if (!root || !icon || !label) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let blocked = false;
    let phase: Phase = "idle";
    let reloadTimer = 0;
    let stuckTimer = 0;

    const setPhaseVisual = (next: Phase, dy = 0) => {
      phase = next;
      const offset = Math.min(MAX_INDICATOR_PX, Math.max(0, dy * RESISTANCE));

      if (next === "idle") {
        root.style.transition = "transform 0.22s ease, opacity 0.22s ease";
        root.style.opacity = "0";
        root.style.transform = "translate3d(-50%, -120%, 0)";
        icon.style.transform = "";
        icon.classList.remove("animate-spin");
        label.textContent = "";
        root.setAttribute("aria-hidden", "true");
        return;
      }

      root.style.transition = next === "busy" ? "transform 0.18s ease, opacity 0.18s ease" : "none";
      root.style.opacity = "1";
      root.style.transform = `translate3d(-50%, ${Math.max(0, offset - 8)}px, 0)`;
      root.setAttribute("aria-hidden", next === "busy" ? "false" : "true");

      if (next === "busy") {
        icon.style.transform = "";
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (!reduceMotion) icon.classList.add("animate-spin");
        label.textContent = "更新中";
        return;
      }

      icon.classList.remove("animate-spin");
      const progress = Math.min(1, dy / THRESHOLD_PX);
      icon.style.transform = `rotate(${progress * 180}deg)`;
      label.textContent = next === "armed" ? "離して更新" : "引っ張って更新";
    };

    const resetPull = () => {
      tracking = false;
      pulling = false;
      blocked = false;
      if (phase !== "busy") setPhaseVisual("idle");
    };

    const onStart = (event: TouchEvent) => {
      if (phase === "busy" || event.touches.length !== 1) return;
      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      pulling = false;
      blocked = isEditableTarget(event.target) || isInsideScrolledY(event.target);
    };

    const onMove = (event: TouchEvent) => {
      if (phase === "busy" || !tracking || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;

      if (!pulling) {
        if (blocked) return;
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > ACTIVATE_PX) {
          tracking = false;
          return;
        }
        if (dy < ACTIVATE_PX) return;
        if (!isPageAtTop()) return;
        pulling = true;
      }

      if (dy <= 0) {
        setPhaseVisual("idle");
        pulling = false;
        return;
      }

      if (event.cancelable) event.preventDefault();
      setPhaseVisual(dy >= THRESHOLD_PX ? "armed" : "pull", dy);
    };

    const onEnd = () => {
      if (!tracking && phase !== "armed") {
        pulling = false;
        return;
      }
      const shouldReload = phase === "armed";
      tracking = false;
      pulling = false;
      blocked = false;
      if (!shouldReload) {
        setPhaseVisual("idle");
        return;
      }
      setPhaseVisual("busy", THRESHOLD_PX);
      try {
        window.sessionStorage.setItem(CATALOG_FORCE_REFRESH_KEY, "1");
      } catch {
        // ignore quota / private-mode failures
      }
      reloadTimer = window.setTimeout(() => {
        window.location.reload();
      }, 50);
      stuckTimer = window.setTimeout(() => {
        if (phase === "busy") setPhaseVisual("idle");
      }, 4000);
    };

    const touchMoveOpts: AddEventListenerOptions = { passive: false, capture: true };
    const captureOpts: AddEventListenerOptions = { capture: true };
    document.addEventListener("touchstart", onStart, { passive: true, capture: true });
    document.addEventListener("touchmove", onMove, touchMoveOpts);
    document.addEventListener("touchend", onEnd, captureOpts);
    document.addEventListener("touchcancel", onEnd, captureOpts);
    return () => {
      window.clearTimeout(reloadTimer);
      window.clearTimeout(stuckTimer);
      document.removeEventListener("touchstart", onStart, captureOpts);
      document.removeEventListener("touchmove", onMove, touchMoveOpts);
      document.removeEventListener("touchend", onEnd, captureOpts);
      document.removeEventListener("touchcancel", onEnd, captureOpts);
      resetPull();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed left-1/2 z-[80] flex flex-col items-center gap-1"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 8px)",
        opacity: 0,
        transform: "translate3d(-50%, -120%, 0)",
      }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-hidden="true"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-turf shadow-md ring-1 ring-ink/10">
        <div ref={iconRef} className="flex h-5 w-5 items-center justify-center">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
            <path
              d="M21 12a9 9 0 1 1-2.6-6.2"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M21 4v6h-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <p
        ref={labelRef}
        className="empty:hidden rounded-full bg-white/95 px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap text-turf shadow-sm ring-1 ring-ink/10"
      />
    </div>
  );
}

function isPageAtTop() {
  return getScrollTop() <= TOP_SLACK_PX;
}

function getScrollTop() {
  const scrolling = document.scrollingElement;
  const wrap = document.body?.firstElementChild;
  return Math.max(
    window.scrollY || 0,
    document.documentElement.scrollTop || 0,
    document.body.scrollTop || 0,
    scrolling instanceof HTMLElement ? scrolling.scrollTop : 0,
    wrap instanceof HTMLElement ? wrap.scrollTop : 0,
  );
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function isInsideScrolledY(target: EventTarget | null) {
  let el: HTMLElement | null = target instanceof HTMLElement ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const overflowY = window.getComputedStyle(el).overflowY;
    const canScroll =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      el.scrollHeight > el.clientHeight + 1;
    if (canScroll && el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}
