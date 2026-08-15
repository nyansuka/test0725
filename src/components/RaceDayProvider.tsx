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
import { getJstDateString } from "@/domain/date";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { listRaceDates, liveRaceDate } from "@/data/races";

const STORAGE_KEY = "umanote-race-date";
const STORAGE_LIVE_KEY = "umanote-race-date-live";

type RaceDayContextValue = {
  /** 選択中の開催日 YYYY-MM-DD（デフォルトは JST 当日、なければ最新スナップショット日） */
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToday: () => void;
  today: string;
  availableDates: string[];
  hydrated: boolean;
};

const RaceDayContext = createContext<RaceDayContextValue | null>(null);

function defaultRaceDate(today: string, available: string[], fallbackLive: string) {
  if (available.includes(today)) return today;
  if (available.includes(fallbackLive)) return fallbackLive;
  return available[0] ?? today;
}

/** live スナップが変わったらデフォルト日へ。同じ live なら前回選択を維持。 */
function pickRaceDate(
  today: string,
  available: string[],
  fallbackLive: string,
  saved: string | null,
  savedLive: string | null,
) {
  const preferred = defaultRaceDate(today, available, fallbackLive);
  if (fallbackLive && savedLive !== fallbackLive) return preferred;
  if (saved && available.includes(saved)) return saved;
  return preferred;
}

export function RaceDayProvider({ children }: { children: ReactNode }) {
  const { races, liveRaceDate: catalogLive } = useRaceCatalog();
  const today = getJstDateString();
  const availableDates = useMemo(() => listRaceDates(races), [races]);
  const live = catalogLive ?? liveRaceDate;
  // SSR 安定: 壁時計の today は使わずスナップショット日で初期化（クライアントと一致させる）
  const [selectedDate, setSelectedDateState] = useState(live);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // 初回マウントのみ（依存に races を入れると API ポーリングで選択が上書きされる）
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const savedLive = window.localStorage.getItem(STORAGE_LIVE_KEY);
    const dates = listRaceDates(races);
    const fallback = catalogLive ?? liveRaceDate;
    const next = pickRaceDate(getJstDateString(), dates, fallback, saved, savedLive);
    setSelectedDateState(next);
    if (fallback) window.localStorage.setItem(STORAGE_LIVE_KEY, fallback);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from SSR initial catalog
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const fallback = catalogLive ?? liveRaceDate;
    const savedLive = window.localStorage.getItem(STORAGE_LIVE_KEY);
    if (!fallback || savedLive === fallback) return;
    const next = pickRaceDate(getJstDateString(), availableDates, fallback, null, savedLive);
    setSelectedDateState(next);
    window.localStorage.setItem(STORAGE_LIVE_KEY, fallback);
  }, [hydrated, catalogLive, availableDates, live]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, selectedDate);
    if (live) window.localStorage.setItem(STORAGE_LIVE_KEY, live);
  }, [selectedDate, hydrated, live]);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);

  const goToday = useCallback(() => {
    setSelectedDateState(defaultRaceDate(getJstDateString(), availableDates, live));
  }, [availableDates, live]);

  const value = useMemo(
    () => ({
      selectedDate,
      setSelectedDate,
      goToday,
      today,
      availableDates,
      hydrated,
    }),
    [selectedDate, setSelectedDate, goToday, today, availableDates, hydrated],
  );

  return <RaceDayContext.Provider value={value}>{children}</RaceDayContext.Provider>;
}

export function useRaceDay() {
  const ctx = useContext(RaceDayContext);
  if (!ctx) throw new Error("useRaceDay must be used within RaceDayProvider");
  return ctx;
}
