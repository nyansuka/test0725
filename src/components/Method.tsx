const steps = [
  {
    title: "オッズゲート",
    body: "各券種でオッズが設定閾値未満の買い目は除外。初期閾値は20倍。複勝を含む全券種が対象です。",
  },
  {
    title: "複勝圏スコア",
    body: "コース適性・展開・馬場・近況・人気乖離などから placePotential を算出。関係馬は下限合成。差し替え可能なルール実装です。",
  },
  {
    title: "候補と見送り",
    body: "ゲート通過かつ最低スコア以上が注目穴ボードへ。ゲートのみ通過でスコア不足は詳細オッズ板で「見送り」と表示します。",
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
        <p className="mt-3 max-w-2xl text-sand/75">
          本命探しではなく高配当候補の選別が主機能です。JRAのみ・全券種対応。レース期待度は
          S（高スコア候補が複数）〜 D（候補なし／薄い）。的中保証はありません。
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
