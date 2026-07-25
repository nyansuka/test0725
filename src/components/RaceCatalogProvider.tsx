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
import { races as seedRaces, snapshotMeta as seedMeta } from "@/data/races";
import type { Race } from "@/domain/types";

type CatalogValue = {
  races: Race[];
  fetchedAt: string | null;
  source: string | null;
  liveRaceDate: string | null;
  refreshing: boolean;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogValue | null>(null);

const POLL_MS = 60_000;

export function RaceCatalogProvider({ children }: { children: ReactNode }) {
  const [races, setRaces] = useState<Race[]>(seedRaces);
  const [fetchedAt, setFetchedAt] = useState<string | null>(seedMeta.fetchedAt);
  const [source, setSource] = useState<string | null>(seedMeta.source);
  const [liveRaceDate, setLiveRaceDate] = useState<string | null>(seedMeta.raceDate);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/races", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        races: Race[];
        fetchedAt: string | null;
        source: string | null;
        raceDate: string | null;
      };
      if (Array.isArray(data.races) && data.races.length > 0) {
        setRaces(data.races);
        setFetchedAt(data.fetchedAt);
        setSource(data.source);
        setLiveRaceDate(data.raceDate);
      }
    } catch {
      // keep previous
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const value = useMemo(
    () => ({ races, fetchedAt, source, liveRaceDate, refreshing, refresh }),
    [races, fetchedAt, source, liveRaceDate, refreshing, refresh],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useRaceCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useRaceCatalog must be used within RaceCatalogProvider");
  return ctx;
}
