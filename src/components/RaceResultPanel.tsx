import type { Race } from "@/domain/types";
import { displayFinishJockey, formatFinishLine, groupPayouts, payoutLabel } from "@/domain/results";

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
  const payoutGroups = groupPayouts(result.payouts);

  return (
    <section className={compact ? "space-y-2" : "space-y-6"}>
      <div>
        <h2 className={`font-semibold text-ink ${compact ? "text-sm" : "text-xl"}`}>レース結果</h2>
        <p className={`text-ink/60 ${compact ? "mt-1 text-xs" : "mt-2 text-sm"}`}>
          {formatFinishLine(result)}
        </p>
      </div>

      <ul className="divide-y divide-ink/10 md:hidden">
        {finishes.map((f) => (
          <li
            key={f.number}
            className={`py-1.5 ${compact ? "text-xs" : "text-sm"} ${
              f.rank != null && f.rank <= 3 ? "bg-turf/5" : ""
            }`}
          >
            <p className="min-w-0 break-words">
              <span className="font-[family-name:var(--font-display)] font-semibold text-turf">
                {f.rank ?? "—"}着
              </span>
              <span className="ml-2 font-semibold tabular-nums">{f.number}</span>
              <span className="ml-1.5 font-medium">{f.name}</span>
            </p>
            <p className="mt-0.5 text-[11px] text-ink/55">
              {displayFinishJockey(race, f)}
              {f.time ? ` · ${f.time}` : ""}
              {f.popularity != null ? ` · ${f.popularity}人` : ""}
            </p>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
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
                <td className="px-1.5 py-1 text-ink/60">{displayFinishJockey(race, f)}</td>
                <td className="px-1.5 py-1">{f.time ?? "—"}</td>
                <td className="px-1.5 py-1">{f.popularity != null ? `${f.popularity}人` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {payoutGroups.length > 0 && (
        <div>
          <h3 className={`font-semibold text-ink ${compact ? "text-xs" : "text-base"}`}>払戻</h3>
          <ul
            className={`grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 ${
              compact ? "mt-1.5 text-xs" : "mt-3 text-sm"
            }`}
          >
            {payoutGroups.map((group) => (
              <li key={group.betType} className="min-w-0 border-t border-ink/10 pt-1.5">
                <p className="text-[11px] text-ink/45">{payoutLabel(group.betType)}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {group.lines.map((line, i) => (
                    <li
                      key={`${line.selection}-${i}`}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3"
                    >
                      <span className="min-w-0 break-words font-[family-name:var(--font-display)] font-semibold">
                        {line.selection}
                        {line.popularity != null && (
                          <span className="ml-1.5 text-[11px] font-normal text-ink/45">
                            {line.popularity}人気
                          </span>
                        )}
                      </span>
                      <span className="text-right font-medium tabular-nums text-signal">
                        {line.payoutYen.toLocaleString()}円
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
