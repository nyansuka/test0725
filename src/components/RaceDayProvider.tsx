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
import { listRaceDates, liveRaceDate, races } from "@/data/races";

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

function defaultRaceDate(today: string, available: string[]) {
  if (available.includes(today)) return today;
  if (available.includes(liveRaceDate)) return liveRaceDate;
  return available[0] ?? today;
}

export function RaceDayProvider({ children }: { children: ReactNode }) {
  const today = getJstDateString();
  const availableDates = useMemo(() => listRaceDates(races), []);
  const initial = defaultRaceDate(today, availableDates);
  const [selectedDate, setSelectedDateState] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSelectedDateState(defaultRaceDate(today, availableDates));
    setHydrated(true);
  }, [today, availableDates]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, selectedDate);
  }, [selectedDate, hydrated]);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);

  const goToday = useCallback(() => {
    setSelectedDateState(defaultRaceDate(getJstDateString(), availableDates));
  }, [availableDates]);

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
