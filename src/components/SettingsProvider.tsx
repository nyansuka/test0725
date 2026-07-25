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
import { ALL_BET_TYPES, DEFAULT_SETTINGS } from "@/domain/betTypes";
import type { BetType, UserSelectionSettings } from "@/domain/types";

const STORAGE_KEY = "umanote-selection-settings";

type SettingsContextValue = {
  settings: UserSelectionSettings;
  setOddsThreshold: (value: number) => void;
  setScoreMin: (value: number) => void;
  toggleBetType: (betType: BetType) => void;
  setEnabledBetTypes: (types: BetType[]) => void;
  resetSettings: () => void;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): UserSelectionSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] };
    const parsed = JSON.parse(raw) as Partial<UserSelectionSettings>;
    return {
      oddsThreshold: parsed.oddsThreshold ?? DEFAULT_SETTINGS.oddsThreshold,
      scoreMin: parsed.scoreMin ?? DEFAULT_SETTINGS.scoreMin,
      enabledBetTypes: parsed.enabledBetTypes?.length
        ? parsed.enabledBetTypes
        : [...ALL_BET_TYPES],
    };
  } catch {
    return { ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] };
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSelectionSettings>({
    ...DEFAULT_SETTINGS,
    enabledBetTypes: [...ALL_BET_TYPES],
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings, hydrated]);

  const setOddsThreshold = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, oddsThreshold: value }));
  }, []);

  const setScoreMin = useCallback((value: number) => {
    setSettings((prev) => ({ ...prev, scoreMin: value }));
  }, []);

  const toggleBetType = useCallback((betType: BetType) => {
    setSettings((prev) => {
      const has = prev.enabledBetTypes.includes(betType);
      const enabledBetTypes = has
        ? prev.enabledBetTypes.filter((t) => t !== betType)
        : [...prev.enabledBetTypes, betType];
      return {
        ...prev,
        enabledBetTypes: enabledBetTypes.length ? enabledBetTypes : prev.enabledBetTypes,
      };
    });
  }, []);

  const setEnabledBetTypes = useCallback((types: BetType[]) => {
    setSettings((prev) => ({
      ...prev,
      enabledBetTypes: types.length ? types : [...ALL_BET_TYPES],
    }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] });
  }, []);

  const value = useMemo(
    () => ({
      settings,
      setOddsThreshold,
      setScoreMin,
      toggleBetType,
      setEnabledBetTypes,
      resetSettings,
      hydrated,
    }),
    [
      settings,
      setOddsThreshold,
      setScoreMin,
      toggleBetType,
      setEnabledBetTypes,
      resetSettings,
      hydrated,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
