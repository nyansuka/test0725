"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ALL_BET_TYPES, BET_TYPE_LABELS } from "@/domain/betTypes";
import {
  summarizeJournal,
  DEFAULT_JOURNAL_SETTINGS,
  filledBetLines,
  type JournalBetLine,
} from "@/domain/journal";
import type { BetSlipSource, BetType, Race, TipsterKind } from "@/domain/types";
import { formatJstDateLabel } from "@/domain/date";
import {
  completedDayLabelStats,
  formatPrecisionPercent,
} from "@/domain/trends";
import { getTrendIndex } from "@/domain/trendData";
import { summarizeByExpectationRank } from "@/domain/expectationRankStats";
import { races as seedRaces } from "@/data/races";
import { useJournal } from "@/components/JournalProvider";
import { useRaceCatalog } from "@/components/RaceCatalogProvider";
import { useSettings } from "@/components/SettingsProvider";

function formatRate(value: number | null | undefined, suffix = "%"): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}${suffix}`;
}

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createBetLine(
  betType: BetType = "quinella",
  selection = "",
  stakeYen = 1000,
): JournalBetLine {
  return {
    id: newLineId(),
    betType,
    selection,
    stakeYen,
    oddsAtPurchase: "",
    payoutYen: "",
  };
}

function defaultBetLines(): JournalBetLine[] {
  return [createBetLine("quinella"), createBetLine("wide")];
}

export function JournalPanel() {
  const {
    slips,
    tipsters,
    addSlip,
    removeSlip,
    addTipster,
    updateSlip,
    hydrated,
    storage,
    error,
  } = useJournal();
  const { settings, hydrated: settingsHydrated } = useSettings();
  const { races: catalogRaces } = useRaceCatalog();
  const raceOptions = catalogRaces.length > 0 ? catalogRaces : seedRaces;
  const [sourceFilter, setSourceFilter] = useState<"all" | "self" | "tipster">("all");
  const [corpus, setCorpus] = useState<Race[] | null>(null);
  const [corpusDates, setCorpusDates] = useState<string[]>([]);
  const [corpusError, setCorpusError] = useState<string | null>(null);
  const [corpusLoading, setCorpusLoading] = useState(true);

  const [source, setSource] = useState<BetSlipSource>("self");
  const [raceId, setRaceId] = useState(seedRaces[0]?.id ?? "");
  const [betLines, setBetLines] = useState<JournalBetLine[]>(() => defaultBetLines());
  const [tipsterId, setTipsterId] = useState("");
  const [newTipster, setNewTipster] = useState("");
  const [tipsterKind, setTipsterKind] = useState<TipsterKind>("prediction_only");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!raceId && raceOptions[0]?.id) setRaceId(raceOptions[0].id);
    else if (raceId && !raceOptions.some((r) => r.id === raceId) && raceOptions[0]?.id) {
      setRaceId(raceOptions[0].id);
    }
  }, [raceOptions, raceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCorpusLoading(true);
      try {
        const res = await fetch("/api/evaluation-corpus", { cache: "no-store" });
        if (!res.ok) throw new Error(`corpus ${res.status}`);
        const data = (await res.json()) as {
          races: Race[];
          dates: string[];
        };
        if (cancelled) return;
        setCorpus(Array.isArray(data.races) ? data.races : []);
        setCorpusDates(data.dates ?? []);
        setCorpusError(null);
      } catch (err) {
        if (cancelled) return;
        setCorpus([]);
        setCorpusError(err instanceof Error ? err.message : "コーパス取得失敗");
      } finally {
        if (!cancelled) setCorpusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const range = useMemo(() => {
    const now = new Date();
    return {
      from: new Date(now.getFullYear() - 1, 0, 1).toISOString(),
      to: new Date(now.getFullYear() + 1, 11, 31).toISOString(),
    };
  }, []);

  const summary = useMemo(
    () => summarizeJournal(slips, range, sourceFilter, DEFAULT_JOURNAL_SETTINGS),
    [slips, range, sourceFilter],
  );

  const selfSummary = useMemo(
    () => summarizeJournal(slips, range, "self", DEFAULT_JOURNAL_SETTINGS),
    [slips, range],
  );

  const longshotStats = useMemo(
    () => completedDayLabelStats(getTrendIndex(), "注目穴"),
    [],
  );

  const rankStats = useMemo(() => {
    if (!corpus || !settingsHydrated) return null;
    return summarizeByExpectationRank(corpus, settings);
  }, [corpus, settings, settingsHydrated]);

  function updateBetLine(id: string, patch: Partial<JournalBetLine>) {
    setBetLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const lines = filledBetLines(betLines);
    if (lines.length === 0) {
      window.alert("買い目が入った券種を1行以上入力してください。");
      return;
    }
    if (!raceId) {
      window.alert("レースを選択してください。");
      return;
    }

    let resolvedTipsterId = tipsterId || undefined;
    if (source === "tipster") {
      if (newTipster.trim()) {
        resolvedTipsterId = addTipster(newTipster.trim()).id;
      }
      if (!resolvedTipsterId) {
        window.alert("予想家を選択するか、新規名を入力してください。");
        return;
      }
    }

    const sharedNote = note.trim() || undefined;
    for (const line of lines) {
      const payoutRaw = line.payoutYen.trim();
      const payout = payoutRaw === "" ? null : Number(payoutRaw);
      addSlip({
        source,
        raceId,
        betType: line.betType,
        selection: line.selection.trim(),
        stakeYen:
          source === "tipster"
            ? DEFAULT_JOURNAL_SETTINGS.defaultVirtualStakeYen
            : line.stakeYen,
        oddsAtPurchase: line.oddsAtPurchase.trim()
          ? Number(line.oddsAtPurchase)
          : undefined,
        payoutYen: Number.isFinite(payout as number) ? payout : null,
        tipsterId: source === "tipster" ? resolvedTipsterId : undefined,
        tipsterKind: source === "tipster" ? tipsterKind : undefined,
        note: sharedNote,
      });
    }

    setBetLines(defaultBetLines());
    setNote("");
    setNewTipster("");
  }

  const visible = slips.filter(
    (s) => sourceFilter === "all" || s.source === sourceFilter,
  );

  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">レース期待度ランク別</h2>
          <p className="mt-1 text-sm text-ink/55">
            現在の設定（オッズ閾値 {settings.oddsThreshold} / 最低スコア {settings.scoreMin}
            ）で候補を再選別し、期待度 S〜D ごとの複勝圏的中率と仮想回収率を集計します。設定変更ですぐ反映されます。
          </p>
        </div>

        {corpusLoading || !settingsHydrated ? (
          <p className="text-sm text-ink/50">ランク集計を読み込み中…</p>
        ) : corpusError ? (
          <p className="text-sm text-signal">コーパス取得エラー: {corpusError}</p>
        ) : rankStats == null || rankStats.raceCount === 0 ? (
          <p className="text-sm text-ink/50">結果付きの検証レースがまだありません。</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["対象レース", `${rankStats.raceCount}R`],
                ["候補数", rankStats.candidateCount.toLocaleString()],
                [
                  "全体 的中率",
                  formatRate(rankStats.overall.hitRatePercent),
                ],
                [
                  "全体 仮想回収",
                  formatRate(rankStats.overall.returnRatePercent),
                ],
              ].map(([label, value]) => (
                <div key={label} className="border border-ink/10 bg-sand-dim/40 px-4 py-5">
                  <p className="text-xs tracking-wider text-ink/50">{label}</p>
                  <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/20 text-ink/50">
                    <th className="py-2 pr-3 font-medium">期待度</th>
                    <th className="py-2 pr-3 font-medium">レース数</th>
                    <th className="py-2 pr-3 font-medium">候補</th>
                    <th className="py-2 pr-3 font-medium">的中率</th>
                    <th className="py-2 pr-3 font-medium">仮想回収率</th>
                    <th className="py-2 font-medium">的中 / 確定</th>
                  </tr>
                </thead>
                <tbody>
                  {rankStats.byRank.map((row) => (
                    <tr key={row.rank} className="border-b border-ink/10">
                      <td className="py-2.5 pr-3 font-[family-name:var(--font-display)] font-semibold">
                        {row.rank}
                      </td>
                      <td className="py-2.5 pr-3">{row.raceCount}</td>
                      <td className="py-2.5 pr-3">{row.candidates.toLocaleString()}</td>
                      <td className="py-2.5 pr-3 font-[family-name:var(--font-display)] font-medium">
                        {formatRate(row.hitRatePercent)}
                      </td>
                      <td className="py-2.5 pr-3 font-[family-name:var(--font-display)] font-medium">
                        {formatRate(row.returnRatePercent)}
                      </td>
                      <td className="py-2.5 text-ink/70">
                        {row.settled > 0
                          ? `${row.placeHits.toLocaleString()} / ${row.settled.toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-ink/45">
              対象日: {corpusDates.map(formatJstDateLabel).join(" · ") || "—"}
              {" · "}仮想投資 100円/候補 · 払戻突合できる券種のみ回収に加算
            </p>
          </>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">終了日の的中率</h2>
          <p className="mt-1 text-sm text-ink/55">
            注目穴は結果が揃った開催日の候補的中（複勝圏）。自分買い目は払戻確定分の券的中です。
          </p>
        </div>
        <div className="grid gap-4">
          <div className="border border-ink/10 bg-sand-dim/40 px-4 py-5">
            <p className="text-xs tracking-wider text-ink/50">注目穴の的中率</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
              {formatPrecisionPercent(longshotStats.overall.precision)}
            </p>
            <p className="mt-2 text-sm text-ink/55">
              {longshotStats.overall.settled > 0
                ? `${longshotStats.overall.hits.toLocaleString()} / ${longshotStats.overall.settled.toLocaleString()} · ${longshotStats.days.length}日分`
                : "終了した開催日がまだありません"}
            </p>
          </div>
          <div className="border border-ink/10 bg-sand-dim/40 px-4 py-5">
            <p className="text-xs tracking-wider text-ink/50">自分買い目の的中率</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-ink">
              {selfSummary.hitRatePercent == null
                ? "—"
                : `${selfSummary.hitRatePercent}%`}
            </p>
            <p className="mt-2 text-sm text-ink/55">
              {selfSummary.settledCount > 0
                ? `${selfSummary.hitCount.toLocaleString()} / ${selfSummary.settledCount.toLocaleString()} · 確定分`
                : "確定した自分の購入がまだありません"}
              {selfSummary.pendingCount > 0
                ? `（結果待ち ${selfSummary.pendingCount}）`
                : null}
            </p>
          </div>
        </div>
        {longshotStats.days.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/20 text-ink/50">
                  <th className="py-2 pr-3 font-medium">開催日</th>
                  <th className="py-2 pr-3 font-medium">注目穴 的中率</th>
                  <th className="py-2 font-medium">的中 / 件数</th>
                </tr>
              </thead>
              <tbody>
                {longshotStats.days.map((day) => (
                  <tr key={day.date} className="border-b border-ink/10">
                    <td className="py-2.5 pr-3">{formatJstDateLabel(day.date)}</td>
                    <td className="py-2.5 pr-3 font-[family-name:var(--font-display)] font-medium">
                      {formatPrecisionPercent(day.precision)}
                    </td>
                    <td className="py-2.5 text-ink/70">
                      {day.hits.toLocaleString()} / {day.settled.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["投資合計", `${summary.stakeTotal.toLocaleString()}円`],
          ["払戻合計", `${summary.payoutTotal.toLocaleString()}円`],
          ["回収率", `${summary.returnRatePercent}%`],
          [
            "的中率 / 件数",
            summary.hitRatePercent == null
              ? `— · ${summary.betCount}`
              : `${summary.hitRatePercent}% · ${summary.hitCount}/${summary.settledCount}`,
          ],
        ].map(([label, value]) => (
          <div key={label} className="border border-ink/10 bg-sand-dim/40 px-4 py-5">
            <p className="text-xs tracking-wider text-ink/50">{label}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-ink">
              {value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-sm text-ink/55">
        保存先:{" "}
        {storage === "neon"
          ? "Neon DB"
          : storage === "local"
            ? "このブラウザ（DB未接続）"
            : "接続確認中…"}
        {error ? <span className="ml-2 text-signal">· {error}</span> : null}
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["all", "全体"],
            ["self", "自分のみ"],
            ["tipster", "予想家仮想"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSourceFilter(key)}
            className={`border px-3 py-1.5 ${
              sourceFilter === key
                ? "border-turf bg-turf text-sand"
                : "border-ink/15 text-ink/70"
            }`}
          >
            {label}
          </button>
        ))}
        {summary.pendingCount > 0 && (
          <span className="ml-auto text-ink/50">結果待ち {summary.pendingCount} 件</span>
        )}
      </div>

      <form onSubmit={onSubmit} className="space-y-4 border border-ink/10 bg-sand-dim/30 p-5 md:p-6">
        <h2 className="text-lg font-semibold">履歴を追加</h2>
        <p className="text-sm text-ink/55">
          同一レースに馬連・ワイドなど複数券種を行で追加できます（例: 馬連 1-2,3,4 / ワイド 1-2,3,4）。
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm">
            <span className="text-ink/60">区分</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as BetSlipSource)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              <option value="self">自分の購入</option>
              <option value="tipster">予想家の参考買い目</option>
            </select>
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="text-ink/60">レース</span>
            <select
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              {raceOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.raceDate} {r.venue} {r.raceNumber}R {r.title}
                </option>
              ))}
            </select>
          </label>
          {source === "tipster" && (
            <>
              <label className="block text-sm">
                <span className="text-ink/60">種別</span>
                <select
                  value={tipsterKind}
                  onChange={(e) => setTipsterKind(e.target.value as TipsterKind)}
                  className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                >
                  <option value="prediction_only">予想のみ</option>
                  <option value="purchased">購入と公開</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">予想家（既存）</span>
                <select
                  value={tipsterId}
                  onChange={(e) => setTipsterId(e.target.value)}
                  className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                >
                  <option value="">新規入力する</option>
                  {tipsters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="text-ink/60">新規予想家名</span>
                <input
                  value={newTipster}
                  onChange={(e) => setNewTipster(e.target.value)}
                  className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                />
              </label>
            </>
          )}
          <label className="block text-sm sm:col-span-2 lg:col-span-3">
            <span className="text-ink/60">メモ（全券種共通・任意）</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">券種ごとの買い目</h3>
            <button
              type="button"
              onClick={() =>
                setBetLines((prev) => [
                  ...prev,
                  createBetLine(
                    prev.length % 2 === 0 ? "quinella" : "wide",
                    "",
                    prev[0]?.stakeYen ?? 1000,
                  ),
                ])
              }
              className="border border-ink/15 px-3 py-1.5 text-sm text-ink/70 hover:border-ink/40"
            >
              ＋ 券種を追加
            </button>
          </div>
          <ul className="space-y-3">
            {betLines.map((line, index) => (
              <li
                key={line.id}
                className="grid gap-2 border border-ink/10 bg-sand p-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
              >
                <label className="block text-sm lg:col-span-2">
                  <span className="text-ink/60">券種 {index + 1}</span>
                  <select
                    value={line.betType}
                    onChange={(e) =>
                      updateBetLine(line.id, { betType: e.target.value as BetType })
                    }
                    className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                  >
                    {ALL_BET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {BET_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm sm:col-span-2 lg:col-span-3">
                  <span className="text-ink/60">買い目</span>
                  <input
                    value={line.selection}
                    onChange={(e) => updateBetLine(line.id, { selection: e.target.value })}
                    placeholder="例: 1-2,3,4"
                    className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                  />
                </label>
                {source === "self" ? (
                  <label className="block text-sm lg:col-span-2">
                    <span className="text-ink/60">投資額</span>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={line.stakeYen}
                      onChange={(e) =>
                        updateBetLine(line.id, {
                          stakeYen: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                    />
                  </label>
                ) : null}
                <label className="block text-sm lg:col-span-2">
                  <span className="text-ink/60">オッズ（任意）</span>
                  <input
                    value={line.oddsAtPurchase}
                    onChange={(e) =>
                      updateBetLine(line.id, { oddsAtPurchase: e.target.value })
                    }
                    className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                  />
                </label>
                <label className="block text-sm lg:col-span-2">
                  <span className="text-ink/60">払戻</span>
                  <input
                    value={line.payoutYen}
                    onChange={(e) => updateBetLine(line.id, { payoutYen: e.target.value })}
                    placeholder="空=待ち"
                    className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
                  />
                </label>
                <div className="flex items-end lg:col-span-1">
                  <button
                    type="button"
                    disabled={betLines.length <= 1}
                    onClick={() =>
                      setBetLines((prev) => prev.filter((l) => l.id !== line.id))
                    }
                    className="w-full border border-ink/15 px-3 py-2 text-sm text-ink/50 hover:text-ink disabled:opacity-30"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="submit"
          className="bg-turf px-5 py-2.5 text-sm font-medium text-sand hover:bg-turf-deep"
        >
          {filledBetLines(betLines).length > 1
            ? `${filledBetLines(betLines).length}件まとめて保存`
            : "保存する"}
        </button>
      </form>

      <div className="overflow-x-auto">
        {!hydrated ? (
          <p className="text-ink/50">読み込み中…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-ink/50">まだ履歴がありません。</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-ink/20 text-ink/50">
                <th className="py-2 pr-3 font-medium">日時</th>
                <th className="py-2 pr-3 font-medium">区分</th>
                <th className="py-2 pr-3 font-medium">レース</th>
                <th className="py-2 pr-3 font-medium">券種</th>
                <th className="py-2 pr-3 font-medium">買い目</th>
                <th className="py-2 pr-3 font-medium">投資</th>
                <th className="py-2 pr-3 font-medium">払戻</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((slip) => {
                const race = raceOptions.find((r) => r.id === slip.raceId);
                return (
                  <tr key={slip.id} className="border-b border-ink/10">
                    <td className="py-3 pr-3 text-xs text-ink/50">
                      {new Date(slip.createdAt).toLocaleString("ja-JP")}
                    </td>
                    <td className="py-3 pr-3">
                      {slip.source === "self" ? "自分" : "予想家"}
                    </td>
                    <td className="py-3 pr-3">
                      {race ? `${race.venue}${race.raceNumber}R` : slip.raceId}
                    </td>
                    <td className="py-3 pr-3">{BET_TYPE_LABELS[slip.betType]}</td>
                    <td className="py-3 pr-3 font-[family-name:var(--font-display)]">
                      {slip.selection}
                    </td>
                    <td className="py-3 pr-3">{slip.stakeYen.toLocaleString()}</td>
                    <td className="py-3 pr-3">
                      {slip.payoutYen === null ? (
                        <button
                          type="button"
                          className="text-turf underline"
                          onClick={() => {
                            const raw = window.prompt("払戻額（外れは 0）", "0");
                            if (raw == null) return;
                            updateSlip(slip.id, { payoutYen: Number(raw) || 0 });
                          }}
                        >
                          未確定
                        </button>
                      ) : (
                        <span className={slip.payoutYen > 0 ? "font-medium text-signal" : ""}>
                          {slip.payoutYen.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => removeSlip(slip.id)}
                        className="text-ink/40 hover:text-ink"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
