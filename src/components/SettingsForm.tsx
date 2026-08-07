"use client";

import { ALL_BET_TYPES, BET_TYPE_LABELS, DEFAULT_SETTINGS } from "@/domain/betTypes";
import { NumberStepper } from "@/components/NumberStepper";
import { useSettings } from "@/components/SettingsProvider";

export function SettingsForm() {
  const {
    settings,
    setOddsThreshold,
    setOddsMax,
    setScoreMin,
    toggleBetType,
    setEnabledBetTypes,
    resetSettings,
    hydrated,
  } = useSettings();

  return (
    <div className="space-y-10">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <span className="text-sm text-ink/60">オッズ閾値（以上で候補）</span>
          <NumberStepper
            aria-label="オッズ閾値"
            value={settings.oddsThreshold}
            onChange={(n) => setOddsThreshold(n ?? 1)}
            min={1}
            max={999}
            step={1}
          />
          <p className="mt-2 text-xs text-ink/50">
            初期値 {DEFAULT_SETTINGS.oddsThreshold}。ボード・設定で同期されます。
          </p>
        </div>
        <div>
          <span className="text-sm text-ink/60">オッズ上限（以下で候補）</span>
          <NumberStepper
            aria-label="オッズ上限"
            value={settings.oddsMax}
            onChange={setOddsMax}
            min={1}
            max={999}
            step={1}
            nullable
            emptyLabel="なし"
            nullStepTo={DEFAULT_SETTINGS.oddsMax ?? 80}
          />
          <p className="mt-2 text-xs text-ink/50">
            初期値 {DEFAULT_SETTINGS.oddsMax ?? "なし"}。−で下限未満にすると上限なし。この値を超えるオッズは除外。
          </p>
        </div>
        <div>
          <span className="text-sm text-ink/60">最低スコア（relatedPlacePotential）</span>
          <NumberStepper
            aria-label="最低スコア"
            value={settings.scoreMin}
            onChange={(n) => setScoreMin(n ?? 0)}
            min={0}
            max={100}
            step={1}
          />
          <p className="mt-2 text-xs text-ink/50">
            既定の初期値は {DEFAULT_SETTINGS.scoreMin}
            （入力中の値はブラウザ保存。古い75/80のままなら「初期化」で既定に戻せます）。ボード・日記のランク集計と同期されます。
          </p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">有効な券種</h2>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={() => setEnabledBetTypes([...ALL_BET_TYPES])}
              className="border border-ink/15 px-3 py-1.5 text-ink/70 hover:border-ink/40"
            >
              全選択
            </button>
            <button
              type="button"
              onClick={resetSettings}
              className="border border-ink/15 px-3 py-1.5 text-ink/70 hover:border-ink/40"
            >
              初期化
            </button>
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {ALL_BET_TYPES.map((type) => {
            const on = settings.enabledBetTypes.includes(type);
            return (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => toggleBetType(type)}
                  className={`w-full border px-3 py-3 text-left text-sm transition ${
                    on
                      ? "border-turf bg-turf/10 text-ink"
                      : "border-ink/10 text-ink/40 line-through"
                  }`}
                >
                  {BET_TYPE_LABELS[type]}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {!hydrated && <p className="text-sm text-ink/50">設定を読み込み中…</p>}
    </div>
  );
}
