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
import type { RaceCatalogPayload } from "@/data/catalogTypes";
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

type Props = {
  children: ReactNode;
  /** サーバがディスクから読んだ初期カタログ（静的 import キャッシュ回避） */
  initial?: RaceCatalogPayload;
};

export function RaceCatalogProvider({ children, initial }: Props) {
  const [races, setRaces] = useState<Race[]>(initial?.races ?? seedRaces);
  const [fetchedAt, setFetchedAt] = useState<string | null>(
    initial?.fetchedAt ?? seedMeta.fetchedAt,
  );
  const [source, setSource] = useState<string | null>(initial?.source ?? seedMeta.source);
  const [liveRaceDate, setLiveRaceDate] = useState<string | null>(
    initial?.raceDate ?? seedMeta.raceDate,
  );
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/races", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RaceCatalogPayload;
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
