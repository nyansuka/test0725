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
const MIGRATED_KEY = "umanote-journal-migrated-neon";

type JournalContextValue = {
  slips: BetSlip[];
  tipsters: Tipster[];
  addSlip: (slip: Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }) => void;
  addSlips: (
    inputs: Array<Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }>,
  ) => number;
  updateSlip: (id: string, patch: Partial<BetSlip>) => void;
  removeSlip: (id: string) => void;
  addTipster: (name: string, channelOrMedia?: string) => Tipster;
  hydrated: boolean;
  storage: "neon" | "local" | "loading";
  error: string | null;
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

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildSlip(
  input: Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string },
): BetSlip {
  return {
    ...input,
    id: newId("b"),
    createdAt: input.createdAt ?? new Date().toISOString(),
    hit: input.payoutYen != null ? input.payoutYen > 0 : undefined,
  };
}

export function JournalProvider({ children }: { children: ReactNode }) {
  const [slips, setSlips] = useState<BetSlip[]>([]);
  const [tipsters, setTipsters] = useState<Tipster[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storage, setStorage] = useState<"neon" | "local" | "loading">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const localSlips = loadJson<BetSlip[]>(SLIPS_KEY, []);
      const localTipsters = loadJson<Tipster[]>(TIPSTERS_KEY, []);

      try {
        const res = await fetch("/api/journal");
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `journal API ${res.status}`);
        }
        const data = (await res.json()) as {
          slips: BetSlip[];
          tipsters: Tipster[];
        };

        const alreadyMigrated = window.localStorage.getItem(MIGRATED_KEY) === "1";
        if (
          !alreadyMigrated &&
          (localSlips.length > 0 || localTipsters.length > 0) &&
          data.slips.length === 0 &&
          data.tipsters.length === 0
        ) {
          const mig = await fetch("/api/journal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "migrate",
              slips: localSlips,
              tipsters: localTipsters,
            }),
          });
          if (mig.ok) {
            window.localStorage.setItem(MIGRATED_KEY, "1");
            const again = await fetch("/api/journal");
            if (again.ok) {
              const fresh = (await again.json()) as {
                slips: BetSlip[];
                tipsters: Tipster[];
              };
              if (!cancelled) {
                setSlips(fresh.slips);
                setTipsters(fresh.tipsters);
                setStorage("neon");
                setError(null);
                setHydrated(true);
              }
              return;
            }
          }
        }

        if (!cancelled) {
          setSlips(data.slips);
          setTipsters(data.tipsters);
          setStorage("neon");
          setError(null);
          if (data.slips.length > 0 || data.tipsters.length > 0) {
            window.localStorage.setItem(MIGRATED_KEY, "1");
          }
        }
      } catch (err) {
        console.warn("[journal] Neon unavailable, falling back to localStorage", err);
        if (!cancelled) {
          setSlips(localSlips);
          setTipsters(localTipsters);
          setStorage("local");
          setError(err instanceof Error ? err.message : "DB接続に失敗しました");
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  // local フォールバック時のみ localStorage に書き戻す
  useEffect(() => {
    if (!hydrated || storage !== "local") return;
    window.localStorage.setItem(SLIPS_KEY, JSON.stringify(slips));
  }, [slips, hydrated, storage]);

  useEffect(() => {
    if (!hydrated || storage !== "local") return;
    window.localStorage.setItem(TIPSTERS_KEY, JSON.stringify(tipsters));
  }, [tipsters, hydrated, storage]);

  const addTipster = useCallback(
    (name: string, channelOrMedia?: string) => {
      const tipster: Tipster = {
        id: newId("t"),
        name,
        channelOrMedia,
      };
      setTipsters((prev) => [...prev, tipster]);
      if (storage === "neon") {
        void fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addTipster", tipster }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "予想家の保存に失敗しました");
          }
        });
      }
      return tipster;
    },
    [storage],
  );

  const addSlip = useCallback(
    (input: Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }) => {
      const slip = buildSlip(input);
      setSlips((prev) => [slip, ...prev]);
      if (storage === "neon") {
        void fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addSlip", slip }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "買い目の保存に失敗しました");
          }
        });
      }
    },
    [storage],
  );

  /** 同一レースの複数買い目を一括追加（状態・DBともまとめて） */
  const addSlips = useCallback(
    (inputs: Array<Omit<BetSlip, "id" | "createdAt"> & { createdAt?: string }>) => {
      if (inputs.length === 0) return 0;
      const created = inputs.map((input) => buildSlip(input));
      setSlips((prev) => [...created, ...prev]);
      if (storage === "neon") {
        void fetch("/api/journal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "addSlips", slips: created }),
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "買い目の一括保存に失敗しました");
          }
        });
      }
      return created.length;
    },
    [storage],
  );

  const updateSlip = useCallback(
    (id: string, patch: Partial<BetSlip>) => {
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
      if (storage === "neon") {
        void fetch(`/api/journal/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "更新に失敗しました");
          }
        });
      }
    },
    [storage],
  );

  const removeSlip = useCallback(
    (id: string) => {
      setSlips((prev) => prev.filter((s) => s.id !== id));
      if (storage === "neon") {
        void fetch(`/api/journal/${encodeURIComponent(id)}`, {
          method: "DELETE",
        }).then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            setError(body.error ?? "削除に失敗しました");
          }
        });
      }
    },
    [storage],
  );

  const value = useMemo(
    () => ({
      slips,
      tipsters,
      addSlip,
      addSlips,
      updateSlip,
      removeSlip,
      addTipster,
      hydrated,
      storage,
      error,
    }),
    [
      slips,
      tipsters,
      addSlip,
      addSlips,
      updateSlip,
      removeSlip,
      addTipster,
      hydrated,
      storage,
      error,
    ],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error("useJournal must be used within JournalProvider");
  return ctx;
}
