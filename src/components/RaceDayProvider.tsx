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
import { listRaceDates, races } from "@/data/races";

const STORAGE_KEY = "umanote-race-date";

type RaceDayContextValue = {
  /** 選択中の開催日 YYYY-MM-DD（デフォルトは JST 当日） */
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  goToday: () => void;
  today: string;
  availableDates: string[];
  hydrated: boolean;
};

const RaceDayContext = createContext<RaceDayContextValue | null>(null);

export function RaceDayProvider({ children }: { children: ReactNode }) {
  const today = getJstDateString();
  const availableDates = useMemo(() => listRaceDates(races), []);
  const [selectedDate, setSelectedDateState] = useState(today);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // 保存値が当日以外でも、起動時はカレンダー当日を優先（要件）
      // ただしユーザーが明示変更したセッション内は localStorage を尊重したい場合もある。
      // 要件: デフォルトは当日 → 初回表示は常に today。保存は同日内の再訪用。
      if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        // 当日にレースがある／ないに関わらず、デフォルト表示は today
        setSelectedDateState(today);
      } else {
        setSelectedDateState(today);
      }
    } catch {
      setSelectedDateState(today);
    }
    setHydrated(true);
  }, [today]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, selectedDate);
  }, [selectedDate, hydrated]);

  const setSelectedDate = useCallback((date: string) => {
    setSelectedDateState(date);
  }, []);

  const goToday = useCallback(() => {
    setSelectedDateState(getJstDateString());
  }, []);

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
