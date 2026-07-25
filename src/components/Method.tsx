const steps = [
  {
    title: "ペースを読む",
    body: "逃げ・先行馬の配置からレースの流れを想定し、差しが届くかを見ます。",
  },
  {
    title: "コース適性",
    body: "芝/ダート、距離、馬場状態との相性を信頼度の軸にしています。",
  },
  {
    title: "オッズとの乖離",
    body: "モデル評価と人気の差が大きい馬を、穴候補として切り出します。",
  },
];

export function Method() {
  return (
    <section id="method" className="bg-turf-deep px-6 py-20 text-sand md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-signal-soft">
          HOW IT WORKS
        </p>
        <h2 className="mt-2 text-3xl font-bold md:text-4xl">予想の見方</h2>
        <p className="mt-3 max-w-xl text-sand/75">
          このサイトはデモ用のサンプル予想です。実際の投票や投資判断には使わないでください。
        </p>

        <ol className="mt-14 grid gap-10 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <p className="font-[family-name:var(--font-display)] text-4xl font-bold text-signal-soft/80">
                0{index + 1}
              </p>
              <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-sand/75">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
