"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BET_TYPE_LABELS } from "@/domain/betTypes";
import type { BetType } from "@/domain/types";
import {
  formatCatchRate,
  formatYen,
  HIT_LANE_GATES,
  HIT_LANE_LABELS,
  MAIN_HIT_BET_TYPES,
  type ConditionBucket,
  type GatedHit,
  type HitCatalog,
  type HitConditions,
  type HitLane,
  type LaneConditions,
} from "@/domain/hitCatalog";

const LANES: HitLane[] = ["main", "trio", "trifecta"];

type CatchFilter = "all" | "picked" | "missed";

type Props = {
  catalog: HitCatalog;
  conditions: HitConditions;
};

function pct(n: number | null | undefined) {
  return formatCatchRate(n);
}

function bucketRows(map: Record<string, ConditionBucket> | undefined) {
  return Object.entries(map ?? {}).sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], "ja"));
}

function ConditionTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, ConditionBucket][];
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-ink/10 bg-white p-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-ink/50">該当なし</p>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-xl border border-ink/10 bg-white">
      <h3 className="border-b border-ink/10 px-4 py-3 text-sm font-semibold text-ink">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="text-xs text-ink/50">
            <tr>
              <th className="px-4 py-2 font-medium">条件</th>
              <th className="px-3 py-2 font-medium">件数</th>
              <th className="px-3 py-2 font-medium">捕捉</th>
              <th className="px-3 py-2 font-medium">捕捉率</th>
              <th className="px-4 py-2 font-medium">払戻合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, row]) => (
              <tr key={key} className="border-t border-ink/8">
                <td className="px-4 py-2 font-medium text-ink">{key}</td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{row.n}</td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{row.picked}</td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{pct(row.catchRate)}</td>
                <td className="px-4 py-2 tabular-nums text-ink/80">{formatYen(row.payoutYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CoverageStrip({ lane }: { lane: LaneConditions }) {
  const c = lane.coverage;
  return (
    <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
        <dt className="text-xs text-ink/50">ゲート内的中</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {lane.n}
          <span className="ml-2 text-sm font-normal text-ink/50">件</span>
        </dd>
        <p className="mt-1 text-xs text-ink/45">払戻があり凍結オッズが設定内</p>
      </div>
      <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
        <dt className="text-xs text-ink/50">捕捉 / 未捕捉</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">
          {lane.picked}
          <span className="mx-1 text-sm font-normal text-ink/40">/</span>
          {lane.missed}
        </dd>
        <p className="mt-1 text-xs text-ink/45">捕捉率 {pct(lane.catchRate)}</p>
      </div>
      <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
        <dt className="text-xs text-ink/50">板 → ゲート</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{pct(c.gateRate)}</dd>
        <p className="mt-1 text-xs text-ink/45">
          払戻 {c.payouts} · 凍結板 {c.onBoard} · ゲート {c.gated}
          {c.knownGated != null && c.knownGated !== c.gated ? ` · 予測あり ${c.knownGated}` : ""}
        </p>
      </div>
      <div className="rounded-xl border border-ink/10 bg-white px-4 py-3">
        <dt className="text-xs text-ink/50">ゲート内払戻合計</dt>
        <dd className="mt-1 text-xl font-semibold tabular-nums text-ink">{formatYen(lane.payoutYen)}</dd>
        <p className="mt-1 text-xs text-ink/45">券種・レーンは混ぜない</p>
      </div>
    </dl>
  );
}

function BetTypeOverview({
  lane,
  onSelect,
}: {
  lane: LaneConditions;
  onSelect: (betType: BetType) => void;
}) {
  const rows = MAIN_HIT_BET_TYPES.map((betType) => {
    const detail = lane.byBetTypeDetail?.[betType];
    const bucket = lane.byBetType?.[betType];
    return {
      betType,
      n: detail?.n ?? bucket?.n ?? 0,
      picked: detail?.picked ?? bucket?.picked ?? 0,
      catchRate: detail?.catchRate ?? bucket?.catchRate ?? null,
      payoutYen: detail?.payoutYen ?? bucket?.payoutYen ?? 0,
    };
  });
  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-ink/10 bg-white">
      <h2 className="border-b border-ink/10 px-4 py-3 text-sm font-semibold text-ink">券種別</h2>
      <p className="px-4 pt-3 text-xs text-ink/50">
        基本設定（下限25・上限80）を通った払戻だけ。3連複・3連単は上のレーンへ。券種は合算しません。行を選ぶと発生条件が出ます。
      </p>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full min-w-[32rem] text-left text-sm">
          <thead className="text-xs text-ink/50">
            <tr>
              <th className="px-4 py-2 font-medium">券種</th>
              <th className="px-3 py-2 font-medium">ゲート内</th>
              <th className="px-3 py-2 font-medium">捕捉</th>
              <th className="px-3 py-2 font-medium">捕捉率</th>
              <th className="px-4 py-2 font-medium">払戻合計</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.betType} className="border-t border-ink/8">
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onSelect(row.betType)}
                    className="font-medium text-turf hover:underline"
                  >
                    {BET_TYPE_LABELS[row.betType]}
                  </button>
                </td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{row.n}</td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{row.picked}</td>
                <td className="px-3 py-2 tabular-nums text-ink/80">{pct(row.catchRate)}</td>
                <td className="px-4 py-2 tabular-nums text-ink/80">{formatYen(row.payoutYen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HitRow({ hit }: { hit: GatedHit }) {
  const names = hit.horses.map((h) => h.name).join(" · ");
  return (
    <li className="border-t border-ink/8 px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="tabular-nums text-ink/55">{hit.raceDate}</span>
        <span className="font-medium text-ink">
          {hit.venue}
          {hit.raceNumber}R
        </span>
        <span className="text-ink/70">{BET_TYPE_LABELS[hit.betType] ?? hit.betType}</span>
        <span className="font-mono text-ink">{hit.selection}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            !hit.pickKnown
              ? "bg-ink/5 text-ink/45"
              : hit.picked
                ? "bg-turf/10 text-turf"
                : "bg-ink/5 text-ink/55"
          }`}
        >
          {!hit.pickKnown ? "予測なし" : hit.picked ? "捕捉" : "未捕捉"}
        </span>
        {hit.label ? <span className="text-xs text-ink/45">{hit.label}</span> : null}
      </div>
      <p className="mt-1 text-sm text-ink/70">
        {hit.title}
        {hit.track ? ` · ${hit.track}` : ""}
        {hit.distanceM ? ` ${hit.distanceM}m` : ""}
        {hit.classBand ? ` · ${hit.classBand}` : ""}
      </p>
      <p className="mt-0.5 text-sm text-ink/55">{names}</p>
      <p className="mt-1 text-xs tabular-nums text-ink/50">
        凍結オッズ {hit.odds}
        <span className="mx-2">·</span>
        {hit.oddsBand}
        <span className="mx-2">·</span>
        払戻 {formatYen(hit.payoutYen)}
        {hit.score != null ? (
          <>
            <span className="mx-2">·</span>
            スコア {hit.score}
          </>
        ) : null}
        <span className="mx-2">·</span>
        <Link href={`/races/${hit.raceId}`} className="text-turf hover:underline">
          レース
        </Link>
      </p>
    </li>
  );
}

export function HitCatalogBoard({ catalog, conditions }: Props) {
  const [lane, setLane] = useState<HitLane>("main");
  const [catchFilter, setCatchFilter] = useState<CatchFilter>("all");
  const [venue, setVenue] = useState("all");
  const [betType, setBetType] = useState<"all" | BetType>("all");
  const [oddsBand, setOddsBand] = useState("all");

  const laneHits = useMemo(
    () => catalog.hits.filter((h) => h.lane === lane),
    [catalog.hits, lane],
  );
  const laneCond = conditions.byLane[lane];
  const typeCond =
    lane === "main" && betType !== "all" ? laneCond?.byBetTypeDetail?.[betType] : null;
  const viewCond = typeCond ?? laneCond;
  const showBetOverview = lane === "main" && betType === "all";

  const scopedHits = useMemo(
    () => (betType === "all" ? laneHits : laneHits.filter((h) => h.betType === betType)),
    [laneHits, betType],
  );

  const venues = useMemo(
    () => [...new Set(scopedHits.map((h) => h.venue))].sort((a, b) => a.localeCompare(b, "ja")),
    [scopedHits],
  );
  const oddsBands = useMemo(
    () => [...new Set(scopedHits.map((h) => h.oddsBand))],
    [scopedHits],
  );

  const filtered = useMemo(() => {
    return scopedHits.filter((h) => {
      if (catchFilter === "picked" && !h.picked) return false;
      if (catchFilter === "missed" && (h.picked || !h.pickKnown)) return false;
      if (venue !== "all" && h.venue !== venue) return false;
      if (oddsBand !== "all" && h.oddsBand !== oddsBand) return false;
      return true;
    });
  }, [scopedHits, catchFilter, venue, oddsBand]);

  const scanned = catalog.scannedDates?.length ?? catalog.dates.length;

  return (
    <div>
      <p className="text-sm text-ink/55">
        凍結オッズが当時の設定を満たし、その券種の払戻があったものだけを蓄積しています。
        本体の券種どうし、および 3連複 / 3連単とは混ぜません。選別ロジックは変えません。
        {scanned > 0 ? ` 走査 ${scanned} 日 · ゲート内 ${catalog.hitCount} 件。` : " まだ蓄積がありません。"}
      </p>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="レーン">
        {LANES.map((id) => {
          const active = lane === id;
          const n = conditions.byLane[id]?.n ?? 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setLane(id);
                setCatchFilter("all");
                setVenue("all");
                setBetType("all");
                setOddsBand("all");
              }}
              className={`rounded-full px-4 py-2 text-sm transition ${
                active ? "bg-turf text-sand" : "bg-sand-dim text-ink/70 hover:text-ink"
              }`}
            >
              {HIT_LANE_LABELS[id]}
              <span className="ml-2 tabular-nums opacity-80">{n}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-sm text-ink/50">
        {HIT_LANE_LABELS[lane]}
        {lane === "main" && betType !== "all" ? ` · ${BET_TYPE_LABELS[betType]}` : ""}
        {" · "}
        現行ゲート {HIT_LANE_GATES[lane]}
        {viewCond?.settings
          ? `（下限 ${viewCond.settings.oddsThreshold}${
              viewCond.settings.oddsMax != null ? ` · 上限 ${viewCond.settings.oddsMax}` : " · 上限なし"
            }）`
          : null}
      </p>

      {lane === "main" ? (
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="券種">
          <button
            type="button"
            role="tab"
            aria-selected={betType === "all"}
            onClick={() => {
              setBetType("all");
              setVenue("all");
              setOddsBand("all");
              setCatchFilter("all");
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              betType === "all" ? "bg-ink text-sand" : "bg-sand-dim text-ink/70 hover:text-ink"
            }`}
          >
            券種一覧
          </button>
          {MAIN_HIT_BET_TYPES.map((t) => {
            const n = laneCond?.byBetTypeDetail?.[t]?.n ?? laneCond?.byBetType?.[t]?.n ?? 0;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={betType === t}
                onClick={() => {
                  setBetType(t);
                  setVenue("all");
                  setOddsBand("all");
                  setCatchFilter("all");
                }}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  betType === t ? "bg-ink text-sand" : "bg-sand-dim text-ink/70 hover:text-ink"
                }`}
              >
                {BET_TYPE_LABELS[t]}
                <span className="ml-1.5 tabular-nums opacity-80">{n}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {showBetOverview && laneCond ? (
        <BetTypeOverview lane={laneCond} onSelect={(t) => {
          setBetType(t);
          setVenue("all");
          setOddsBand("all");
          setCatchFilter("all");
        }} />
      ) : viewCond ? (
        <CoverageStrip lane={viewCond} />
      ) : null}

      {!showBetOverview ? (
        <>
          <h2 className="mt-10 text-lg font-semibold text-ink">発生条件</h2>
          <p className="mt-1 text-sm text-ink/50">
            この券種のゲート内的中の内訳。捕捉は当日の候補に入っていた件数です。
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ConditionTable title="開催日" rows={bucketRows(viewCond?.byDay)} />
            <ConditionTable title="会場" rows={bucketRows(viewCond?.byVenue)} />
            <ConditionTable title="芝・ダート" rows={bucketRows(viewCond?.byTrack)} />
            {lane !== "main" || betType === "all" ? (
              <ConditionTable
                title="券種"
                rows={bucketRows(viewCond?.byBetType).map(([k, v]) => [
                  BET_TYPE_LABELS[k as keyof typeof BET_TYPE_LABELS] ?? k,
                  v,
                ])}
              />
            ) : null}
            <ConditionTable title="オッズ帯" rows={bucketRows(viewCond?.byOddsBand)} />
            <ConditionTable title="クラス" rows={bucketRows(viewCond?.byClass)} />
            <ConditionTable title="距離" rows={bucketRows(viewCond?.byDistance)} />
            <ConditionTable title="頭数" rows={bucketRows(viewCond?.byField)} />
            <ConditionTable title="曜日" rows={bucketRows(viewCond?.byWeekday)} />
            <ConditionTable title="天候" rows={bucketRows(viewCond?.byWeather)} />
            <ConditionTable title="ラベル" rows={bucketRows(viewCond?.byLabel)} />
          </div>
        </>
      ) : null}

      <h2 className="mt-10 text-lg font-semibold text-ink">的中一覧</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["all", "すべて"],
            ["picked", "捕捉のみ"],
            ["missed", "未捕捉のみ"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCatchFilter(id)}
            className={`rounded-full px-3 py-1.5 text-xs ${
              catchFilter === id ? "bg-ink text-sand" : "bg-sand-dim text-ink/70"
            }`}
          >
            {label}
          </button>
        ))}
        <select
          aria-label="会場"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">会場すべて</option>
          {venues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <select
          aria-label="オッズ帯"
          value={oddsBand}
          onChange={(e) => setOddsBand(e.target.value)}
          className="rounded-full border border-ink/10 bg-white px-3 py-1.5 text-xs text-ink"
        >
          <option value="all">オッズ帯すべて</option>
          {oddsBands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-2 text-xs text-ink/45">
        {filtered.length} / {scopedHits.length} 件を表示
      </p>

      <ul className="mt-3 overflow-hidden rounded-xl border border-ink/10 bg-white">
        {filtered.length === 0 ? (
          <li className="px-4 py-8 text-sm text-ink/50">この条件の的中はありません。</li>
        ) : (
          [...filtered].reverse().map((hit) => <HitRow key={hit.id} hit={hit} />)
        )}
      </ul>
    </div>
  );
}
