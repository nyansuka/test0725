import { WEIGHT_SECTION, WORKOUT_SECTION } from "@/domain/supplementNotes";

const steps = [
  {
    title: "オッズゲート",
    body: "各券種でオッズが設定閾値未満、または上限を超える買い目は除外。初期は下限25・上限80。複勝を含む全券種が対象です。",
  },
  {
    title: "複勝圏スコア（穴）",
    body: "コース適性・展開・馬場・近況・人気乖離などから placePotential を算出。近況は前走（あれば）、人気乖離は単勝人気から導出。検証済み場の距離別は枠（gateJockey）へ±4以内。courseFit は同条件成績のまま。関係馬は下限合成。馬単だけ1着を winPotential、2着を placePotential の下限（軸×穴）。差し替え可能なルール実装です。",
  },
  {
    title: "軸馬・超注目",
    body: "別スコア winPotential で1着見込みを出し、レース内 Top3 を軸馬候補とします。人気を強く反映し、Top3 に中穴が無いときだけ 6〜10人気を適性条件（前走勝ち／複勝圏＋適性、同条件ベストタイムがレース内上位20%、または適性合成≥65）かつスコアが3枠目に近い場合に差し替えます。11人気以下は対象外。",
  },
  {
    title: "危険1人気",
    body: "1番人気を無条件では消しません。人気を除いた1着適性がレース中央値未満、先行有利コース（新潟芝、および検証済み距離）で差し・追込、または前走から半年以上（180日）の休み明けのときに「危1」印を付けます。前走日が無い馬では休み明けは発火しません。軸候補からは外さず、高配当狙いの相手カット用です。",
  },
  {
    title: "短評（評価＋傾向）",
    body: "短評は①オッズ帯のベース文 ②因子トップの評価 ③改善ループ蓄積（券種・会場芝ダ等）の候補成功率。ボード上の成否は券種払戻のヒット。短評の成功率は関係馬が3着以内の参考値です。馬の前走成績ではなく、過去候補の統計です。他日があれば表示日を除外し、他日が無いときだけ当日検証を注記付きで使います。",
  },
  {
    title: "候補・注目穴・見送り",
    body: "ゲート通過かつ最低スコア以上（初期65）がボード掲載。うちスコアが [65,70) のものを候補（注目穴）、それ以外を候補（抑え候補）とラベル。ゲートのみ通過でスコア不足は詳細オッズ板で「見送り」。2026-09-12〜13 は既存のゲート内候補を残したまま、本体は軸帯×中穴の合成を平均に緩和し、3連複は人気相手を1頭増やし、3連単は人気帯の1着軸を足す。追加分だけ候補（検討）。結果は券種の払戻があればヒット、なければはずれです。関係馬の着順は参考表示です。",
  },
];

export function Method() {
  return (
    <section id="method" className="bg-turf-deep px-4 py-10 text-sand sm:px-6 md:px-8 md:py-14">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-lg font-bold sm:text-xl">予想の見方</h2>
        <p className="mt-1 max-w-2xl text-sm text-sand/70">
          本命探しではなく高配当候補の選別。穴（複勝圏）と軸（1着）を分け、交差を超注目とします。
        </p>

        <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-signal-soft/80">
                0{index + 1}
              </p>
              <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-sand/70">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 border-t border-sand/15 pt-8">
          <p className="text-xs tracking-wider text-sand/45">コース参考</p>
          <h3 className="mt-1 text-base font-semibold">競馬場・距離の読み方</h3>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-sand/70">
            レース詳細に形状だけ出す。見る軸は回り・坂・最初のコーナーまでの長さ・ダートの芝スタート。検証済みの距離だけ枠スコアへ小さく寄せる（place でおおむね ±0.4）。前残りは危1の差し・追込判定に使う。京都は未検証。脚質データが薄いので展開適性には載せない。
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h4 className="text-sm font-semibold">形状として使う</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-sand/70">
                <li>回り。左は東京・中京・新潟。右が7場。</li>
                <li>坂。中山・阪神はゴール前急坂。東京は平坦ではない。小倉は直線だけ平坦。</li>
                <li>1角までの距離。同じ周回ならスタートが約200m後ろにずれる組がある。差し最有利には読み替えない。阪神芝1800（外）と2000（内）、新潟芝1800（外）と2000（内）は別コース。</li>
                <li>芝スタート。外が芝を長く踏める。東京ダ1600・中山ダ1200・阪神ダ1400・中京ダ1400・新潟ダ1200は枠へ小さく。阪神ダ2000・福島ダ1150は弱め。京都ダ1400は未検証。</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold">使わない</h4>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-sand/70">
                <li>関西馬・メイン／ローカルの格付け。</li>
                <li>通常ダート＝内枠。ダートはもともと外寄り。</li>
                <li>1800で届かなかった差しを2000で狙う、という脚質の入替。</li>
                <li>平坦連勝→急坂で危険人気、の自動判定。血統・転戦ローテの数字。</li>
                <li>場や馬を瞬発戦／持続力戦に固定する。ラップの二分法はスコアにもコース参考にも載せない。</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-sand/15 pt-8">
          <p className="text-xs tracking-wider text-sand/45">スコア外の補足</p>
          <h3 className="mt-1 text-base font-semibold">調教・馬体重の読み方</h3>
          <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-sand/70">
            穴／軸スコア・危険1人気・3連系研究所には入れない。公開情報に皆が飛びつく／怯えるとオッズが歪む、という見方だけを残す。調教履歴と当日馬体重はスナップショット未収録のため、JRA・新聞で確認する。レース詳細の補足に、見る対象の注目穴／抑え候補を出している。
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {[WORKOUT_SECTION, WEIGHT_SECTION].map((section) => (
              <div key={section.id}>
                <h4 className="text-sm font-semibold">{section.title}</h4>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-sand/70">
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
