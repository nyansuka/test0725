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
          当日全レースの人気×人気×穴を hit / ev 指数で並べます。板に無い組み合わせは「板なし」と出し、的中集計は板つきだけ数えます。
        </p>
      </div>
      <SanrenLabBoard lane="trio" />
    </div>
  );
}
