"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BetSlip, Tipster } from "@/domain/types";

const SLIPS_KEY = "umanote-bet-slips";
const TIPSTERS_KEY = "umanote-tipsters";

type JournalContextValue = {
  slips: BetSlip[];
  tipsters: Tipster[];
  addSlip: (slip: Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }) => void;
  updateSlip: (id: string, patch: Partial<BetSlip>) => void;
  removeSlip: (id: string) => void;
  addTipster: (name: string, channelOrMedia?: string) => Tipster;
  hydrated: boolean;
};

const JournalContext = createContext<JournalContextValue | null>(null);

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [slips, setSlips] = useState<BetSlip[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSlips(loadJson(SLIPS_KEY, []));
    setTipsters(loadJson(TIPSTERS_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
  }, [slips, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TIPSTERS_KEY, JSON.stringify(tipsters));
  }, [tipsters, hydrated]);

  const addTipster = useCallback((name: string, channelOrMedia?: string) => {
    const tipster: Tipster = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      channelOrMedia,
    };
    setTipsters((prev) => [...prev, tipster]);
    return tipster;
  }, []);

  const addSlip = useCallback(
    (input: Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }) => {
      const slip: BetSlip = {
        ...input,
        id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: input.createdAt ?? new Date().toISOString(),
        hit: input.payoutYen != null ? input.payoutYen > 0 : undefined,
      };
      setSlips((prev) => [slip, ...prev]);
    },
    [],
  );

  const updateSlip = useCallback((id: string, patch: Partial<BetSlip>) => {
    setSlips((prev) =>
      prev.map((slip) => {
        if (slip.id !== id) return slip;
        const next = { ...slip, ...patch };
        if (patch.payoutYen !== undefined) {
          next.hit = patch.payoutYen != null ? patch.payoutYen > 0 : undefined;
          if (patch.payoutYen != null) next.settledAt = new Date().toISOString();
        }
        return next;
      }),
    );
  }, []);

  const removeSlip = useCallback((id: string) => {
    setSlips((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const value = useMemo(
    () => ({
      slips,
      tipsters,
      addSlip,
      updateSlip,
      removeSlip,
      addTipster,
      hydrated,
    }),
    [slips, tipsters, addSlip, updateSlip, removeSlip, addTipster, hydrated],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
