const steps = [
  {
    title: "オッズゲート",
    body: "各券種でオッズが設定閾値未満、または上限を超える買い目は除外。初期は下限25・上限80。複勝を含む全券種が対象です。",
  },
  {
    title: "複勝圏スコア（穴）",
    body: "コース適性・展開・馬場・近況・人気乖離などから placePotential を算出。関係馬は下限合成。差し替え可能なルール実装です。",
  },
  {
    title: "軸馬・超注目",
    body: "別スコア winPotential で1着見込みを出し、レース内 Top3 を軸馬候補とします。人気を強く反映し、Top3 に中穴が無いときだけ 6〜10人気を適性条件（前走勝ち／複勝圏＋適性、同条件ベストタイムがレース内上位20%、または適性合成≥65）かつスコアが3枠目に近い場合に差し替えます。11人気以下は対象外。",
  },
  {
    title: "短評（評価＋傾向）",
    body: "短評は①オッズ帯のベース文 ②因子トップの評価 ③改善ループ蓄積（券種・会場芝ダ等）の候補成功率。成功は関係馬が3着以内（馬券内以上）。馬の前走成績ではなく、過去候補の統計です。他日があれば表示日を除外し、他日が無いときだけ当日検証を注記付きで使います。",
  },
  {
    title: "候補と見送り",
    body: "ゲート通過かつ最低スコア以上が注目穴ボードへ。ゲートのみ通過でスコア不足は詳細オッズ板で「見送り」と表示。結果は1着＝大当たり・2〜3着＝馬券内・4着以下＝はずれです。",
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
          本命探しではなく高配当候補の選別が主機能です。穴（複勝圏）と軸（1着）を分け、交差を超注目として示します。JRAのみ・全券種対応。的中保証はありません。
        </p>

        <ol className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
