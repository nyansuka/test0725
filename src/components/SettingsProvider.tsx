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

/** v5: C1/C2 後 scoreMin 既定 75→60。v4 は oddsMax 既定80 */
const STORAGE_KEY = "umanote-selection-settings-v5";
const LEGACY_STORAGE_KEYS = [
  "umanote-selection-settings-v4",
  "umanote-selection-settings-v3",
];

type SettingsContextValue = {
  settings: UserSelectionSettings;
  setOddsThreshold: (value: number) => void;
  setOddsMax: (value: number | null) => void;
  setScoreMin: (value: number) => void;
  toggleBetType: (betType: BetType) => void;
  setEnabledBetTypes: (types: BetType[]) => void;
  resetSettings: () => void;
  hydrated: boolean;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function normalizeSettings(parsed: Partial<UserSelectionSettings>): UserSelectionSettings {
  return {
    oddsThreshold: parsed.oddsThreshold ?? DEFAULT_SETTINGS.oddsThreshold,
    oddsMax:
      parsed.oddsMax === undefined ? DEFAULT_SETTINGS.oddsMax : parsed.oddsMax,
    scoreMin: parsed.scoreMin ?? DEFAULT_SETTINGS.scoreMin,
    enabledBetTypes: parsed.enabledBetTypes?.length
      ? parsed.enabledBetTypes
      : [...ALL_BET_TYPES],
  };
}

function loadSettings(): UserSelectionSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] };
  }
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    let fromLegacyV4 = false;
    if (!raw) {
      for (const key of LEGACY_STORAGE_KEYS) {
        raw = window.localStorage.getItem(key);
        if (raw) {
          fromLegacyV4 = key.endsWith("-v4") || key.endsWith("-v3");
          break;
        }
      }
    }
    if (!raw) return { ...DEFAULT_SETTINGS, enabledBetTypes: [...ALL_BET_TYPES] };
    const parsed = JSON.parse(raw) as Partial<UserSelectionSettings>;
    // v3 には oddsMax が無い → 新既定 80 を入れる
    if (parsed.oddsMax === undefined) {
      parsed.oddsMax = DEFAULT_SETTINGS.oddsMax;
    }
    // v4 既定 scoreMin=75 は C1/C2 後に候補が消える → 60 へ移行
    if (fromLegacyV4 && parsed.scoreMin === 75) {
      parsed.scoreMin = DEFAULT_SETTINGS.scoreMin;
    }
    return normalizeSettings(parsed);
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

  const setOddsMax = useCallback((value: number | null) => {
    setSettings((prev) => ({ ...prev, oddsMax: value }));
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
      setOddsMax,
      setScoreMin,
      toggleBetType,
      setEnabledBetTypes,
      resetSettings,
      hydrated,
    }),
    [
      settings,
      setOddsThreshold,
      setOddsMax,
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
