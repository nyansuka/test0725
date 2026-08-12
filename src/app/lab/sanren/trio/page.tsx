import { SanrenLabBoard } from "@/components/SanrenLabBoard";

export default function SanrenTrioLabPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-turf">
          TRIO LANE
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">3連複研究</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          人気帯の軸×相手に穴を組み合わせた順不同フォーメーション。万馬券帯を残しつつ低配当を切った候補を当日横断で一覧します。
        </p>
      </div>
      <SanrenLabBoard lane="trio" />
    </div>
  );
}
