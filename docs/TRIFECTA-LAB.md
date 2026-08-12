# UMANOTE 3連系研究所 構成計画書

最終更新: 2026-08-12（S3 /lab/sanren UI）  
親計画: [PLAN.md](./PLAN.md)（JRA・全券種の高配当選別）  
関連: [DATA-AND-LOOP.md](./DATA-AND-LOOP.md)、[HIT-RATE-PLAN.md](./HIT-RATE-PLAN.md)、[IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md)、[NAR-PLAN.md](./NAR-PLAN.md)  
位置づけ: PLAN §5.5 **X4（軸×穴コンボ生成）** の自然な後継。券種を **3連系（`trio` / `trifecta`）** に特化した別施策。  
ファイル名 `TRIFECTA-LAB.md` は歴史的経緯。内容の正は **3連系研究所**。

外部参考（買い方ルールのみ。印・個別予想はコピーしない）:

| 券種 | 出典 | 詳細 |
|------|------|------|
| 3連単 | [効果的な3連単の買い方](https://www.youtube.com/watch?v=nqJIZUH4-E0) | §3.2 / 付録 C |
| 3連複 | [3連複の買い方](https://www.youtube.com/watch?v=raVpDFLDUio) | §3.3 / 付録 D |

---

## 1. 目的

**3連複（`trio`）と 3連単（`trifecta`）** の高配当候補を、軸・相手・（単は並び）の観点で短時間に見極められる **研究所面** をつくる。

- 傘ブランド: **3連系研究所**（UMANOTE サブラベル）
- 研究は **券種別に分離**する（設定・生成・KPI・週次実験を混ぜない）
- 本命探しではなく、オッズゲート通過後の「3頭が馬券内に届きうるか／並びが成立しうるか」の選別

UMANOTE 本体（全券種フラット一覧）は維持し、研究所は **別ルート** で体験を分離する。  
本計画は実装着手前の方針・境界・段階を固定する。JRA 現行サイト（https://test0725.vercel.app/）の安定運用・`site:verify-vercel` を壊さないことを最優先制約とする。

---

## 2. 親プロダクトからの前提

| 項目 | 現状（UMANOTE 本体） | 研究所への含意 |
|------|----------------------|----------------|
| コア価値 | 全券種の穴候補選別 | 券種を **trio / trifecta** に絞る |
| 候補単位 | `券種 × 買い目` フラット | 複: 軸×相手（順不同）／単: 軸×相手×**並び** |
| スコア | `placePotential` / `winPotential` 分離 | 複は place 中心、単は 1着=win・2–3=place |
| 自動コンボ | 初期対象外（§5.5 X4 後続） | 研究所が初めて **制限付き買い目列挙** を製品化 |
| 合成 | 関係馬の **下限**（`min`） | 3連は passMiss の主因。**券種別に**実験 |
| デフォルト券種 | 全券種 ON 寄り（HIT-RATE では 3連 OFF 案あり） | **本体デフォルトは変えない**。研究所面のみ |
| 主指標 | ticketPrecision | **trio / trifecta を別切片**で計測 |
| 改善ループ | 週次で変更は **1つだけ** | 研究レーンも **どちらか一方だけ** 変更 |
| 地方 | NAR は別計画 | **JRA 先行** |

---

## 3. 確定したい方針（提案）

| # | 論点 | 提案 | 理由 |
|---|------|------|------|
| 1 | 製品形態 | 同一リポ・別ルート（例: `/lab/sanren`、配下に複／単） | ドメイン共用。本体を汚さない |
| 2 | ブランド | 「**3連系研究所**」。内に **3連複研究** / **3連単研究** | 傘は共通、研究は分離 |
| 3 | 対象 | **JRA のみ先行** | PLAN 本体と同じ |
| 4 | 研究分離 | settings・生成関数・KPI・週次実験を **券種で分離** | 仮値・仮説が異なるため |
| 5 | 共通コア体験 | 高配当レース優先・危険人気カット・制限付き formation | 両動画で共通 |
| 6 | 日記 | `/journal` + `trio` / `trifecta` フィルタ | スキーマ最小 |
| 7 | 買い方モード | 初期は両レーンとも **formation 系のみ** | ボックス（単のマルチ含む）は初期除外 |

### 3.1 研究レーン（必須分離）

| レーン | betType | 主問 | 軸の意味 | 仮ゲート |
|--------|---------|------|----------|----------|
| **3連複研究** | `trio` | 3頭が順不同で馬券内か | 人気帯からの軸（複勝圏） | odds ≥ **100**（仮） |
| **3連単研究** | `trifecta` | 着順どおりか | 1着固定（単勝延長） | odds ≥ **200**（仮） |

制約:

- 同一週に両レーンの閾値・合成を同時変更しない（DATA-AND-LOOP の1変更ルール）
- 合算 KPI を主表示にしない（比較用の副表示は可）
- UI はタブまたはサブパスで明確に分ける

### 3.2 3連単レーン — 仮初期値

出典: [3連単の買い方](https://www.youtube.com/watch?v=nqJIZUH4-E0)。的中保証ではない。

| 項目 | 仮初期値 | 根拠（動画の主張） | 検証時の見方 |
|------|----------|-------------------|--------------|
| `formMode` | `formation`（1着固定＋2/3列裏返し） | フォーメーション本線 | ticketPrecision / 仮想RR |
| `box` / `multi` | **OFF・非表示** | 低期待値目の強制購入 | T5 以降の比較可 |
| `oddsThreshold` | **200** | 200倍未満はほぼ切る | スイープ |
| `oddsMax` | **null** | 中〜高配当帯 | 外れ値のみ後続 |
| 軸 | `winPotential` Top3 プール／生成は1頭固定 | 単勝の延長 | 軸1着 Recall |
| 2列 `partnerCap` | **2〜3** | 印相当 | 点数 vs ticket |
| 3列 | 広め流し（危険人気除く） | 手広く拾う | `topN` で抑制 |
| `topNPerRace` | **50〜100点**目安 | 5〜20万帯狙い | 点数分布 |
| レース優先 | 期待度 **S〜A** | 高配当レース狙い打ち | 期待度別 RR |

### 3.3 3連複レーン — 仮初期値

出典: [3連複の買い方](https://www.youtube.com/watch?v=raVpDFLDUio)。的中保証ではない。

| 項目 | 仮初期値 | 根拠（動画の主張） | 検証時の見方 |
|------|----------|-------------------|--------------|
| `formMode` | `formation`（軸＋相手流し。**順不同**） | フォーメーションで点数制御 | ticketPrecision / 仮想RR |
| `box` | **初期 OFF**（無制限ボックス禁止） | 低配当・低期待値目の混入を避ける | 後続比較可 |
| `oddsThreshold` | **100** | 万馬券帯を残し、低配当目を切る | スイープ（80/100/150） |
| `oddsMax` | **null** | 高配当のみ狙う | 同上 |
| 軸 | **人気帯（仮: 単勝人気 1〜5）** かつ place/win 上位 | 「軸は人気馬から」 | 軸∈1〜3着率 |
| 相手（穴枠） | **6人気以下**を手広く | 人気×人気×穴が万馬券の主パターン | パターン別 ticket |
| 危険人気カット | **1〜2人気の危険馬を軸・相手から除外** | 高配当出現の条件 | 合成オッズ・RR |
| 狙う決着型 | **人気×人気×穴** を主。穴×穴×穴は狙わない | 万馬券の大半が前者 | 型別ヒット |
| レース優先 | 期待度 **S〜A**（荒れ・穴介入が見込める日） | 高配当レースだけ参加 | 期待度別 RR |
| 点数 | 低配当カット後に **合成オッズが立つ**範囲 | 低配当を残すと合成が潰れる | 合成オッズ分布 |

人気の定義（仮）: 単勝人気順位。データ欠落時は単勝オッズ順位で代用。

### 3.4 まだ未確定

- ルート名（`/lab/sanren` + `/trio` `/trifecta` は仮）
- 危険人気除外の厳密式（両レーン共通化するか）
- 3連複の「人気1〜5」境界のスイープ
- 3連単3列「全流し」の切る位置
- ML（当面ルールのみ）
- 通知
- 動画個別の印・レース再現（**やらない**）

---

## 4. 成功の定義

次を満たせば「3連系研究所として選別できる」状態とする。

| # | 条件 |
|---|------|
| A | 当日 JRA で **trio / trifecta それぞれ**「オッズ ≥ 閾値」候補を厳選一覧できる |
| B | 各候補に軸・関係馬スコア・根拠（短評）が見える（単は並びも） |
| C | 候補密度が閲覧可能（レーンごとに点数予算で制御） |
| D | ticketPrecision / 仮想回収率が **trio・trifecta 別**に週次計測できる |
| E | 本体 `/longshots`・`site:verify-vercel` を壊さない |
| F | ユーザーが軸×相手を短時間で組める（自動全列挙は必須にしない） |
| G | 両レーンの設定・実験が混線しない（UI・レポートで分離） |

補足: 的中保証は対象外。

---

## 5. やること／やらないこと

### 5.1 やること（初期〜中期）

- 3連系ラボ画面（複／単の分離 UI）
- **3連単:** 1着固定 formation（2/3列裏返し）
- **3連複:** 人気軸＋穴流し formation（順不同・低配当カット）
- レーン別 settings（閾値・partnerCap・topN・人気帯）
- ticketHit の **券種別**評価レーン
- 払戻パース健全性（Fuku3 / Tan3）
- 期待度 S〜A の優先表示
- 危険人気カットの仮ルール（両レーンで共有しうるが係数は別でも可）

### 5.2 やらないこと（初期）

- 自動投票・自動購入
- 無制限ボックス／3連単マルチの製品化
- 本体デフォルトで trio/trifecta を強制 ON
- placeHit を主 KPI にすること
- **両レーン合算を主 KPI にすること**
- 外部動画の印・個別予想のコピー
- NAR 同時立ち上げ
- 本格資金管理
- 同一週に両レーンを同時にいじること

---

## 6. 既存資産（再利用）

### 6.1 ドメイン

- `betType: "trio" | "trifecta"`（`betTypes.ts`）
- `selectLongshots`（オッズゲート＋下限合成）
- `selectAxisHorses`（`winPotential` Top3）— 単レーンで特に有効
- 超注目 = 注目穴関係馬 ∩ 軸 Top3
- journal の 3頭ながし（trio/trifecta）

### 6.2 データ・検証

- snapshots の `oddsBoard`
- 結果払戻 Fuku3 / Tan3（Sanrenpuku / Sanrentan）
- freeze → evaluate → trends
- ticketPrecision 主指標（HIT-RATE）
- P0-2: trio/trifecta 払戻修正（**両レーン共通の計測前提**）

---

## 7. 現状ギャップ

| 課題 | 根拠 | 含意 |
|------|------|------|
| placeHit が 3連で水増し | HIT-RATE | 主指標は ticketHit のみ |
| 払戻欠損リスク | IMPROVEMENT P0-2 → **S1 で SP `<br>` 欠落を修正** | 再発防止は `audit-sanren-payouts` / 回帰テスト |
| 下限合成 × scoreMin | passMiss の大半が 3連系 | **レーン別** scoreMin / 合成 |
| 候補密度過多 | 組合せ爆発 | 点数予算・人気帯・閾値 |
| HIT-RATE B2 は 3連 OFF 推奨 | 本体ノイズ | 本体と研究所を分離 |
| 複と単で仮説が違う | 外部参考2本 | **研究レーン必須分離** |

---

## 8. 選別ロジック（案）

### 8.1 共通 Hard Filter

```
candidate.betType ∈ { "trio", "trifecta" }
candidate.odds >= settings[betType].oddsThreshold
candidate.odds <= settings[betType].oddsMax   // null 可
race.authority === "JRA"
lane.settings.formMode === "formation"
```

### 8.2 3連単 formation（仮）

```
axisPool = winPotential Top3
foreach axis in selectedAxes:
  col2 = place 上位 partnerCap2
  col3 = 流し（危険人気・重複除く）
  emit ordered:
    axis → col2 × col3
    axis → col3 × col2
  drop odds < 200（仮）
  keep topNPerRace（50〜100点目安）
```

### 8.3 3連複 formation（仮）

```
popular = 単勝人気 1..5（仮）
longshots = 単勝人気 6..（仮）
axis = popular ∩（place/win 上位）から選ぶ   // 穴を軸にしない（仮方針）
partnersPopular = popular \ {axis, dangerousFavs} の上位
partnersHole = longshots を手広く（partnerCapHole）
emit unordered combinations of size 3:
  { axis, p2, hole } を主パターン
  （穴×穴×穴は生成しない）
drop odds < 100（仮）
keep topNPerRace
```

補足: 3連複は着順を持たない。`selection` はソート済み `"2-5-11"` 等で正規化する。

### 8.4 Soft スコア

```
relatedScore 初期 = min(place of related horses)
  // 単: 補助として win(axis) を短評に
  // 複: 補助として「人気軸か」「穴枠を含むか」をラベルに
```

### 8.5 出力ラベル（案）

| ラベル | 条件（案） |
|--------|------------|
| 研究所注目 | ゲート＋スコア通過かつ型が主パターン |
| 抑え | ゲート通過だが注目帯外 |
| 見送り | オッズゲートのみ（詳細板） |

---

## 9. データモデル拡張（案）

```ts
type SanrenBetType = "trio" | "trifecta";
type SanrenFormMode = "formation" | "box" | "multi"; // 初期実装は formation のみ有効

type SanrenLaneSettings = {
  betType: SanrenBetType;
  oddsThreshold: number;       // trio:100仮 / trifecta:200仮
  oddsMax: number | null;
  scoreMin: number;
  formMode: SanrenFormMode;
  topNPerRace: number;
  preferExpectationRanks?: Array<"S" | "A" | "B" | "C" | "D">;
  // trifecta
  partnerCap2?: number;
  partnerCap3?: number;
  axisTopN?: number;           // winPotential プール
  // trio
  popularRankMax?: number;     // 仮 5
  holeRankMin?: number;        // 仮 6
  partnerCapHole?: number;
  excludeDangerousFavs?: boolean;
};

type SanrenLabSettings = {
  trio: SanrenLaneSettings;
  trifecta: SanrenLaneSettings;
};

type SanrenPick = {
  raceId: string;
  betType: SanrenBetType;
  selection: string;           // trio: 昇順 / trifecta: 着順
  odds: number;
  axisHorseNumber: number;
  relatedHorseNumbers: number[]; // 3頭
  pattern?: "fav_fav_hole" | "ordered_axis" | "other";
  relatedScore: number;
  label: "研究所注目" | "抑え";
  hasSuperWatch?: boolean;
  comment?: string;
};
```

選別関数（案）— **分離必須**:

```ts
selectTrioLab(races: Race[], settings: SanrenLaneSettings): SanrenPick[]
selectTrifectaLab(races: Race[], settings: SanrenLaneSettings): SanrenPick[]

// ラッパ（混在表示用。KPI集計には使わない）
selectSanrenLab(races, settings: SanrenLabSettings): {
  trio: SanrenPick[];
  trifecta: SanrenPick[];
}
```

制約:

- UI は関数結果のみ表示
- `BetSlip` はスコア入力に使わない
- box / multi / 無制限生成は初期 Domains に含めない

---

## 10. 画面構成（案）

| 画面 | 役割 |
|------|------|
| `/lab/sanren` | ハブ。複／単カード導線 |
| `/lab/sanren/trio` | **3連複研究**メイン一覧 |
| `/lab/sanren/trifecta` | **3連単研究**メイン一覧 |
| `/races/[id]` | 研究所候補ハイライト（侵襲最小） |
| `/journal` | trio / trifecta フィルタ |
| ラボ settings | **レーン別**閾値・人気帯・partnerCap |

本体 `/`・`/longshots`・`/settings` のデフォルトは変えない。

---

## 11. 実装フェーズ

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| S0 | 方針文書化（本ドキュメント） | 3連系・レーン分離・仮値が固定 |
| S1 | 計測: trio **かつ** trifecta 払戻が evaluate に載る | **済（2026-08-11）** 複数日で両券種 3脚 `payoutYen>0`・lookup 可。SP `<br>` 欠落を修正 |
| S2a | ドメイン: `selectTrifectaLab`（§8.2） | **済（2026-08-12）** `src/domain/sanrenLab.ts`。formation＋odds≥200。密度はオッズ板カバレッジ依存（目安レース数件〜十数件） |
| S2b | ドメイン: `selectTrioLab`（§8.3） | **済（2026-08-12）** `fav_fav_hole`＋odds≥100。買い目は昇順正規化 |
| S3 | UI: `/lab/sanren`＋複／単分離一覧 | **済（2026-08-12）** ハブ＋`/trio` `/trifecta`。レーン別一覧・ticketHit・当日横断 |
| S4 | ループ: レーン別 freeze/evaluate 指標 | 週次で **別々の** ticketPrecision |
| S5 | **1レーン・1変更**実験 | 密度・ticket・仮想RRの方向が分かる |
| S6（後続） | 危険人気式の正式化・日記プリフィル | 別途方針後 |

S2a / S2b は並行可。S5 は同時変更禁止。

---

## 12. 依存・リスク

### 12.1 ブロッカー

- ~~trio/trifecta 実払戻が安定しない~~ → **S1 解消**（3脚 lookup 可）。候補 ticketHits はゲート依存で別問題
- 合成 factors のままではスコア調整が弱い（D4）

### 12.2 リスクと緩和

| リスク | 緩和 |
|--------|------|
| 組合せ爆発 | formation・人気帯・topN・閾値 |
| 複と単の仮説混線 | レーン分離・合算KPI禁止 |
| 本体ノイズ | 研究所面のみ ON |
| placeHit の嘘 | ticketHit 必須 |
| 外部参考の過信 | 印不採用。仮値は捨てる前提 |
| 週次衝突 | 1レーン・1変更/週 |
| 本番壊し | 別ルート＋`site:verify-vercel` |

---

## 13. 推奨する次の一手

1. ~~**S1:** 払戻健全性~~ → **完了**
2. ~~**S2a:** `selectTrifectaLab`~~ → **完了**
3. ~~**S2b:** `selectTrioLab`~~ → **完了**（`scripts/test-select-trio-lab.mjs`）
4. ~~**S3:** `/lab/sanren` UI~~ → **完了**
5. **S4:** レーン別 freeze/evaluate 指標（合算 KPI 禁止）
6. 別ルートのみ。**本体デフォルト券種は変えない**

### S1 メモ（2026-08-11）

- 原因: SP 結果 HTML の `<span>10<br></span>` で 3 脚目が落ち、買い目が 2 脚化（8/8 全レース等）
- 修正: `parseResultHtml` が `li` テキスト優先＋ span 内 `<br>` 許容。PC/SP は払戻完成度で選択
- 回帰: `scripts/test-payout-parse.mjs`（PC + SP fixture）
- 監査: `node scripts/audit-sanren-payouts.mjs`（7/25・8/2・8/8・8/9 で両券種 36/36）
- 注意: 候補の `ticketHits` が 0 でも、**結果払戻テーブルが正しい**ことが S1 完了条件。的中件数はゲート設定依存

### S2a メモ（2026-08-12）

- `selectTrifectaLab`: 軸=winPotential Top3（危険人気1着除外仮）→ place 上位を2列・3列 → 裏返し列挙
- ゲート: oddsBoard 上の trifecta のみ、`odds≥200`、`relatedScore=min(place)≥60`、`topNPerRace=80`
- 確認: 8/9 で 151件/31R（平均≈4.9）、8/8 で 114件/29R。理論上の 50〜100点は板に無い組合せが多いため未達になりやすい（板カバレッジの制約）
- fetcher 側で trifecta 板を厚くするのは別変更

### S2b メモ（2026-08-12）

- `selectTrioLab`: 人気1〜5から軸・相手、6人気以下を穴枠 → **fav_fav_hole のみ**（穴×穴×穴は出さない）
- ゲート: oddsBoard 上の trio、`odds≥100`、買い目は昇順 `"1-5-13"`、危険人気は軸・人気相手から除外
- 確認: 8/9 で 91件/30R（平均≈3.0）、8/8 で 104件/27R。全件 `pattern=fav_fav_hole`
- `selectSanrenLab` ラッパあり（KPI 合算には使わない）

### S3 メモ（2026-08-12）

- ルート: `/lab/sanren`（ハブ）・`/lab/sanren/trio`・`/lab/sanren/trifecta`
- UI: `SanrenLabHub` / `SanrenLabBoard` / `SanrenLabTable`。レーン別ローカル閾値（本体 Settings 非侵襲）
- 主表示: ticketHit（`findPayoutYen`）。ヘッダに「3連研」導線
- 次: S4（レーン別ループ指標）

---

## 付録 A: 用語

| 用語 | 意味 |
|------|------|
| 3連系研究所 | trio + trifecta の選別・検証傘（UMANOTE サブラベル） |
| 3連複研究 / 3連単研究 | 傘の下の **独立研究レーン** |
| ticketHit | 実払戻突合の的中（主指標） |
| placeHit | 複勝圏ヒット（参考のみ） |
| formation | 制限付き軸＋相手生成（単は着順あり、複は順不同） |
| fav_fav_hole | 人気×人気×穴（3連複の主狙い型） |
| SanrenPick | 研究所候補1件 |
| X4 | PLAN §5.5 コンボ生成。本施策がその製品化レーン |

## 付録 B: 本体 PLAN との差分

| 本体 | 研究所 |
|------|--------|
| 全券種フラット | **trio / trifecta のみ**（レーン分離） |
| 自動コンボは後続 | formation 制限付きがコア |
| 共通 settings | **レーン別** settings |
| `/longshots` | `/lab/sanren/...`（仮） |

## 付録 C: 外部参考 — 3連単

出典: [効果的な3連単の買い方](https://www.youtube.com/watch?v=nqJIZUH4-E0)

| 主張 | 反映 | 状態 |
|------|------|------|
| フォーメーション本線 | trifecta `formation` | 仮 |
| ボックス／マルチ不利 | 初期やらない | 採用 |
| 単勝の延長 | 1着=`winPotential` | 採用 |
| 50〜100点 | `topN` / partnerCap | 仮 |
| 200倍未満カット | threshold 200 | 仮 |
| 危険人気を1着から外す | 除外ルール候補 | 未確定式 |
| 高配当レース | 期待度 S〜A | 仮 |
| 印・裏情報 | 取り込まない | 除外 |

## 付録 D: 外部参考 — 3連複

出典: [3連複の買い方](https://www.youtube.com/watch?v=raVpDFLDUio)

| 主張 | 反映 | 状態 |
|------|------|------|
| 高配当レースだけ参加 | 期待度 S〜A 優先 | 仮 |
| 軸は人気馬（1〜5） | `popularRankMax: 5` | 仮 |
| 穴を軸にしない | 穴×穴×穴非生成 | 仮方針 |
| 主パターンは人気×人気×穴 | `pattern: fav_fav_hole` | 仮 |
| 危険な人気を消す | `excludeDangerousFavs` | 候補 |
| 100倍未満を切る | trio threshold 100 | 仮・要スイープ |
| 3列目は手広く流す | `partnerCapHole` 広め | 仮 |
| 合成オッズを意識 | 低配当カットで合成を立てる | 計測後続 |
| 印・個別予想 | 取り込まない | 除外 |

## 付録 E: 3連単 vs 3連複（対照）

| 観点 | 3連複研究 | 3連単研究 |
|------|-----------|-----------|
| 順不同 | はい | いいえ |
| 軸 | 人気帯（place寄り） | 1着（win） |
| 仮 odds 下限 | 100 | 200 |
| 主パターン | fav×fav×hole | 軸1着固定＋裏返し |
| マルチ | 対象外 | 初期除外 |
| KPI | trio ticket 切片 | trifecta ticket 切片 |
| 参考動画 | [raVpDFLDUio](https://www.youtube.com/watch?v=raVpDFLDUio) | [nqJIZUH4-E0](https://www.youtube.com/watch?v=nqJIZUH4-E0) |
