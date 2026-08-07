import type { Race } from "@/domain/types";
import { formatFinishLine, payoutLabel } from "@/domain/results";

type Props = {
  race: Race;
};

export function RaceResultPanel({ race }: Props) {
  const result = race.result;
  if (!result?.finishes?.length) {
    return (
      <section>
        <h2 className="text-xl font-semibold text-ink">レース結果</h2>
        <p className="mt-3 text-sm text-ink/55">まだ結果がありません（発走後に自動取得します）。</p>
      </section>
    );
  }

  const finishes = [...result.finishes].sort(
    (a, b) => (a.rank ?? 99) - (b.rank ?? 99) || a.number - b.number,
  );

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">レース結果</h2>
        <p className="mt-2 text-sm text-ink/60">{formatFinishLine(result)}</p>
      </div>

      <ul className="space-y-2 md:hidden">
        {finishes.map((f) => (
          <li
            key={f.number}
            className={`flex items-start gap-3 border border-ink/10 px-3 py-3 ${
              f.rank != null && f.rank <= 3 ? "bg-turf/5" : "bg-sand-dim/30"
            }`}
          >
            <span className="w-8 shrink-0 font-[family-name:var(--font-display)] text-lg font-semibold text-turf">
              {f.rank ?? "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                <span className="mr-2 font-semibold">{f.number}</span>
                {f.name}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                {f.jockey ?? "—"}
                {" · "}
                {f.time ?? "—"}
                {" · "}
                {f.popularity != null ? `${f.popularity}人` : "—"}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-ink/20 text-ink/50">
              <th className="py-2 pr-3 font-medium">着順</th>
              <th className="py-2 pr-3 font-medium">馬番</th>
              <th className="py-2 pr-3 font-medium">馬名</th>
              <th className="py-2 pr-3 font-medium">騎手</th>
              <th className="py-2 pr-3 font-medium">タイム</th>
              <th className="py-2 font-medium">人気</th>
            </tr>
          </thead>
          <tbody>
            {finishes.map((f) => (
              <tr
                key={f.number}
                className={`border-b border-ink/10 ${f.rank != null && f.rank <= 3 ? "bg-turf/5" : ""}`}
              >
                <td className="py-2 pr-3 font-[family-name:var(--font-display)] text-base font-semibold text-turf">
                  {f.rank ?? "—"}
                </td>
                <td className="py-2 pr-3 font-semibold">{f.number}</td>
                <td className="py-2 pr-3 font-medium">{f.name}</td>
                <td className="py-2 pr-3 text-ink/60">{f.jockey ?? "—"}</td>
                <td className="py-2 pr-3">{f.time ?? "—"}</td>
                <td className="py-2">{f.popularity != null ? `${f.popularity}人` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result.payouts.length > 0 && (
        <div>
          <h3 className="text-base font-semibold text-ink">払戻</h3>
          <ul className="mt-3 space-y-1.5 text-sm text-ink/75">
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
