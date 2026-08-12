import { SanrenLabBoard } from "@/components/SanrenLabBoard";

export default function SanrenTrifectaLabPage() {
  return (
    <div>
      <div className="mb-8">
        <p className="font-[family-name:var(--font-display)] text-xs tracking-[0.18em] text-turf">
          TRIFECTA LANE
        </p>
        <h2 className="mt-1 text-xl font-bold text-ink sm:text-2xl">3連単研究</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/65">
          1着を winPotential 上位で固定し、2・3着を裏返し列挙した制限付きフォーメーション。高配当帯の並び候補を当日横断で一覧します。
        </p>
      </div>
      <SanrenLabBoard lane="trifecta" />
    </div>
  );
}
