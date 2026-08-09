import type { Race } from "@/domain/types";
import { formatFinishLine, payoutLabel } from "@/domain/results";

type Props = {
  race: Race;
  compact?: boolean;
};

export function RaceResultPanel({ race, compact = false }: Props) {
  const result = race.result;
  if (!result?.finishes?.length) {
    return (
      <section>
        <h2 className={`font-semibold text-ink ${compact ? "text-sm" : "text-xl"}`}>レース結果</h2>
        <p className={`text-ink/55 ${compact ? "mt-1 text-xs" : "mt-3 text-sm"}`}>
          まだ結果がありません（発走後に自動取得します）。
        </p>
      </section>
    );
  }

  const finishes = [...result.finishes].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.number - b.number,
  );

  return (
    <section className={compact ? "space-y-2" : "space-y-6"}>
      <div>
        <h2 className={`font-semibold text-ink ${compact ? "text-sm" : "text-xl"}`}>レース結果</h2>
        <p className={`text-ink/60 ${compact ? "mt-1 text-xs" : "mt-2 text-sm"}`}>
          {formatFinishLine(result)}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table
          className={`w-full text-left ${compact ? "min-w-[480px] text-xs" : "min-w-[520px] text-sm"}`}
        >
          <thead>
            <tr className="border-b border-ink/15 text-ink/45">
              <th className="px-1.5 py-1 font-medium">着</th>
              <th className="px-1.5 py-1 font-medium">馬番</th>
              <th className="px-1.5 py-1 font-medium">馬名</th>
              <th className="px-1.5 py-1 font-medium">騎手</th>
              <th className="px-1.5 py-1 font-medium">タイム</th>
              <th className="px-1.5 py-1 font-medium">人気</th>
            </tr>
          </thead>
          <tbody>
            {finishes.map((f) => (
              <tr
                key={f.number}
                className={`border-b border-ink/10 ${f.rank != null && f.rank <= 3 ? "bg-turf/5" : ""}`}
              >
                <td className="px-1.5 py-1 font-[family-name:var(--font-display)] font-semibold text-turf">
                  {f.rank ?? "—"}
                </td>
                <td className="px-1.5 py-1 font-semibold tabular-nums">{f.number}</td>
                <td className="px-1.5 py-1 font-medium">{f.name}</td>
                <td className="px-1.5 py-1 text-ink/60">{f.jockey ?? "—"}</td>
                <td className="px-1.5 py-1">{f.time ?? "—"}</td>
                <td className="px-1.5 py-1">{f.popularity != null ? `${f.popularity}人` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.payouts.length > 0 && (
        <div>
          {!compact ? <h3 className="text-base font-semibold text-ink">払戻</h3> : null}
          <ul
            className={`flex flex-wrap gap-x-4 gap-y-1 text-ink/75 ${
              compact ? "text-xs" : "mt-3 space-y-1.5 text-sm"
            }`}
          >
            {result.payouts.map((p, i) => (
              <li key={`${p.betType}-${p.selection}-${i}`}>
                <span className="text-ink/50">{payoutLabel(p.betType)}</span>{" "}
                <span className="font-[family-name:var(--font-display)] font-semibold">
                  {p.selection}
                </span>{" "}
                <span className="font-medium text-signal">{p.payoutYen.toLocaleString()}円</span>
                {p.popularity != null && (
                  <span className="text-ink/45"> · {p.popularity}人気</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
