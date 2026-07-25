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

export function RaceDayProvider({ children }: { children: ReactNode }) {
  const { races, liveRaceDate: catalogLive } = useRaceCatalog();
  const today = getJstDateString();
  const availableDates = useMemo(() => listRaceDates(races), [races]);
  const live = catalogLive ?? liveRaceDate;
  const initial = defaultRaceDate(today, availableDates, live);
  const [selectedDate, setSelectedDateState] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelectedDateState(defaultRaceDate(today, availableDates, live));
    setHydrated(true);
  }, [today, availableDates, live]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, selectedDate);
  }, [selectedDate, hydrated]);

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
