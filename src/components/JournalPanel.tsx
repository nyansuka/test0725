"use client";

import { useMemo, useState, type FormEvent } from "react";
import { ALL_BET_TYPES, BET_TYPE_LABELS } from "@/domain/betTypes";
import { summarizeJournal, DEFAULT_JOURNAL_SETTINGS } from "@/domain/journal";
import type { BetSlipSource, BetType, TipsterKind } from "@/domain/types";
import { races } from "@/data/races";
import { useJournal } from "@/components/JournalProvider";

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
  const [sourceFilter, setSourceFilter] = useState<"all" | "self" | "tipster">("all");

  const [source, setSource] = useState<BetSlipSource>("self");
  const [raceId, setRaceId] = useState(races[0]?.id ?? "");
  const [betType, setBetType] = useState<BetType>("quinella");
  const [selection, setSelection] = useState("");
  const [stakeYen, setStakeYen] = useState(1000);
  const [oddsAtPurchase, setOddsAtPurchase] = useState("");
  const [payoutYen, setPayoutYen] = useState("");
  const [tipsterId, setTipsterId] = useState("");
  const [newTipster, setNewTipster] = useState("");
  const [tipsterKind, setTipsterKind] = useState<TipsterKind>("prediction_only");
  const [note, setNote] = useState("");

  const summary = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getFullYear() - 1, 0, 1).toISOString();
    const to = new Date(now.getFullYear() + 1, 11, 31).toISOString();
    return summarizeJournal(slips, { from, to }, sourceFilter, DEFAULT_JOURNAL_SETTINGS);
  }, [slips, sourceFilter]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selection.trim()) return;

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

    const payoutRaw = payoutYen.trim();
    const payout = payoutRaw === "" ? null : Number(payoutRaw);

    addSlip({
      source,
      raceId,
      betType,
      selection: selection.trim(),
      stakeYen: source === "tipster" ? DEFAULT_JOURNAL_SETTINGS.defaultVirtualStakeYen : stakeYen,
      oddsAtPurchase: oddsAtPurchase ? Number(oddsAtPurchase) : undefined,
      payoutYen: Number.isFinite(payout as number) ? payout : null,
      tipsterId: source === "tipster" ? resolvedTipsterId : undefined,
      tipsterKind: source === "tipster" ? tipsterKind : undefined,
      note: note.trim() || undefined,
    });

    setSelection("");
    setNote("");
    setPayoutYen("");
    setOddsAtPurchase("");
    setNewTipster("");
  }

  const visible = slips.filter(
    (s) => sourceFilter === "all" || s.source === sourceFilter,
  );

  return (
    <div className="space-y-12">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["投資合計", `${summary.stakeTotal.toLocaleString()}円`],
          ["払戻合計", `${summary.payoutTotal.toLocaleString()}円`],
          ["回収率", `${summary.returnRatePercent}%`],
          ["的中 / 件数", `${summary.hitCount} / ${summary.betCount}`],
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
          <label className="block text-sm">
            <span className="text-ink/60">レース</span>
            <select
              value={raceId}
              onChange={(e) => setRaceId(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              {races.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.raceDate} {r.venue} {r.raceNumber}R {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">券種</span>
            <select
              value={betType}
              onChange={(e) => setBetType(e.target.value as BetType)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            >
              {ALL_BET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">買い目</span>
            <input
              required
              value={selection}
              onChange={(e) => setSelection(e.target.value)}
              placeholder="例: 5-7"
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          {source === "self" ? (
            <label className="block text-sm">
              <span className="text-ink/60">投資額（円）</span>
              <input
                type="number"
                min={100}
                step={100}
                value={stakeYen}
                onChange={(e) => setStakeYen(Number(e.target.value) || 0)}
                className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
              />
            </label>
          ) : (
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
          )}
          <label className="block text-sm">
            <span className="text-ink/60">購入時オッズ（任意）</span>
            <input
              value={oddsAtPurchase}
              onChange={(e) => setOddsAtPurchase(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-ink/60">払戻（空欄=待ち / 0=外れ）</span>
            <input
              value={payoutYen}
              onChange={(e) => setPayoutYen(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
          {source === "tipster" && (
            <>
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
            <span className="text-ink/60">メモ</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full border border-ink/15 bg-sand px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          className="bg-turf px-5 py-2.5 text-sm font-medium text-sand hover:bg-turf-deep"
        >
          保存する
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
                const race = races.find((r) => r.id === slip.raceId);
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
