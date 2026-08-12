# UMANOTE 構成計画書

最終更新: 2026-08-11  
対象リポジトリ: 競馬予想サンプル（Next.js + Docker）  
関連: [DATA-AND-LOOP.md](./DATA-AND-LOOP.md)、[HIT-RATE-PLAN.md](./HIT-RATE-PLAN.md)、[IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md)、[NAR-PLAN.md](./NAR-PLAN.md)、[TRIFECTA-LAB.md](./TRIFECTA-LAB.md)（3連系研究所: 複／単を別研究）

---

## 1. 目的

**JRA の全レース**を対象に、**各券種で配当（オッズ）が閾値以上**となりうる候補のうち、**関係馬が 1〜3着に入る可能性**があるものを、利用者が短時間で見極められるサイト構成をつくる。

本命探しではなく、**高配当候補の選別**を第一機能とする。  
穴馬に加え、**軸馬候補（1着見込み）**を別予測し、穴が軸にもなりうる場合は **超注目馬**とする。利用者が軸×穴の組み合わせを短時間で組める状態を目指す（買い目の自動コンボ生成は初期対象外。3連系特化は [TRIFECTA-LAB.md](./TRIFECTA-LAB.md)）。  
地方競馬（NAR 等）は **本計画（JRA）の対象外**。地方版は隣リポジトリ [`../umanote-nar`](../umanote-nar) と [NAR-PLAN.md](./NAR-PLAN.md)（参照コピー）を参照。

---

## 2. 確定した方針

| # | 論点 | 決定 |
|---|------|------|
| 1 | オッズゲートの券種 | **すべての券種**（単勝・複勝・枠連・馬連・ワイド・馬単・3連複・3連単） |
| 2 | オッズ閾値 | **変更可能**（初期デフォルト 20 倍）。設定 UI を早期に用意 |
| 3 | スコア | 当面 **ルール＋仮スコア**。将来差し替え可能な設計にする |
| 4 | 対象レース | **JRA 全レースのみ**（中央競馬）。地方競馬は含まない |

未確定（後続で決める）:

- 券種別の表示優先度（初期は全券種フラット一覧でよいか）
- 取得の自動化頻度（現状は `npm run fetch:jra` による手動スナップショット）

データソース（当面）:

- **公開Webスナップショット**（netkeiba 出馬表 HTML + オッズ API + 結果ページ）を `src/data/snapshots/` に保存して表示
- **自動取得:** `fetcher` コンテナが発走時刻＋猶予分後のレース結果をポーリング差分更新（既定 90 秒）
- スコア用 factors / comment はルール付与（公開データではない）
- 日付切替デモ用に、スナップショット以外の日は合成データを併用
- オッズ・結果は主催者（JRA）発表と照合すること

---

## 3. 成功の定義

次を満たせば「選別できる」状態とする。

| # | 条件 |
|---|------|
| A | 券種ごとに「オッズ ≥ ユーザー設定閾値」の候補を一覧できる |
| B | 候補に紐づく馬について「1〜3着ポテンシャル」をスコア／ランクで見られる |
| B2 | レースごとに軸馬候補（winPotential Top3）と、穴∩軸の超注目馬が見られる |
| C | なぜ候補にしたかの根拠（短評・指標）が表示される |
| D | 当日の **JRA 全レース**横断で、候補をまとめて確認できる |
| E | オッズ閾値（および最低スコア）を画面上で変更できる |

補足: 実馬券の的中保証は対象外。デモ／検証用の選別ロジックとして扱う。

---

## 4. プロダクト方針

### 4.1 コア価値

- **フィルタ:** 券種ごとのオッズが閾値未満の候補は原則除外（閾値は変更可能）
- **評価:** 関係馬が「人気薄でも 1〜3着に届きうるか」を数値化（穴）。加えて「1着になりやすいか」を数値化（軸）
- **交差:** 穴かつ軸の馬を **超注目馬** とし、高配当のコア候補として強調
- **範囲:** JRA（札幌・函館・福島・新潟・東京・中山・中京・京都・阪神・小倉）のみ
- **提示:** レース単位・当日横断・券種フィルタの3軸。軸／超注目は印と列で併記（自動コンボ一覧は後続）

### 4.2 やらないこと（初期）

- 自動投票・自動購入
- **軸×穴の買い目自動コンボ生成**（印・併記まで。コンボは後続 → [TRIFECTA-LAB.md](./TRIFECTA-LAB.md)）
- 本格的な資金管理（ケリー基準・軍資金シミュレーション等）
- 地方競馬データの取り込み（→ [NAR-PLAN.md](./NAR-PLAN.md)）
- リアルタイムオッズの高頻度更新（第1段階は静的／日次想定。結果は発走後ポーリングで差分取得）
- 機械学習の本番運用（当面はルール＋仮スコア。差し替え余地は残す）

補足: **自分の購入履歴・参考予想家の買い目の手動蓄積と回収率集計**（成績日記）は対象とする。自動投票とは別機能。

---

## 5. 選別ロジック

### 5.1 必須ゲート（Hard Filter）— 全券種

候補単位は「馬」だけでなく **券種 × 買い目** とする。

```
candidate.odds >= oddsThreshold   // ユーザー設定。初期値 20
candidate.betType ∈ JRA全券種
candidate.race.authority === "JRA"
```

対象券種:

| コード | 券種 |
|--------|------|
| `win` | 単勝 |
| `place` | 複勝 |
| `bracket_quinella` | 枠連 |
| `quinella` | 馬連 |
| `wide` | ワイド |
| `exacta` | 馬単 |
| `trio` | 3連複 |
| `trifecta` | 3連単 |

組み合わせ券（馬連・ワイド等）は、買い目に含まれる各馬の `placePotential` を参照し、**関係馬が複勝圏に届く見通し**で評価する。

例:

- 単勝/複勝: 対象馬の `placePotential` をそのまま使用
- ワイド/馬連: 買い目2頭の `placePotential` の合成（**初期は下限**）
- 3連系: 3頭の合成（**初期は下限**）。将来変更可

### 5.2 複勝圏ポテンシャル（Soft Score）

各馬に 0〜100 の `placePotential` を持たせる。

当面は説明可能な **ルール＋仮スコア**。スコアリング実装は **Strategy / 差し替え可能なモジュール** に閉じる。

```
src/domain/scoring/
  types.ts          # Scorer インターフェース
  ruleBased.ts      # 当面の実装
  index.ts          # 利用側は interface のみ依存
```

指標例（仮）:

| 指標 | 意味 | 例の扱い |
|------|------|----------|
| コース適性 | 芝/ダート・距離の相性 | 適性高で加点 |
| 脚質×展開 | 逃げ過多なら差し有利 など | 展開適合で加点 |
| 馬場状態 | 稍重・重などへの適性 | 条件一致で加点 |
| 枠・騎手 | 芝は内枠(1〜3)／ダートは外枠(6〜8)の軽微加点。騎手実績は将来 | 軽微加点 |
| 前走内容 | 着順・上がり・不利の有無 | 内容良好で加点 |
| 人気との乖離 | 実力評価とオッズの差 | 乖離大で加点 |

```
placePotential = currentScorer.score(horse, race)
候補表示条件 =
  odds >= oddsThreshold
  AND relatedPlacePotential >= scoreMin
  AND race.authority === "JRA"
```

- `oddsThreshold` 初期値: `20`（変更可能）
- `scoreMin` 初期値: `60`（変更可能）

### 5.3 出力ラベル

| ラベル | 条件 |
|--------|------|
| 注目穴 | オッズ≥閾値 かつ relatedPlacePotential ≥ scoreMin かつ **[65, 70)** |
| 抑え候補 | オッズ≥閾値 かつ scoreMin 以上だが、スコアが 65 未満または 70 以上 |
| 見送り | オッズ≥閾値（ゲート通過）だが relatedPlacePotential < scoreMin。注目穴ボードには出さず、**レース詳細のオッズ板**で表示 |
| 軸馬候補 | 馬単位。`winPotential` がレース内 **上位3頭（Top3）**（単勝オッズ上限なし）。オッズゲートは不要 |
| 超注目馬 | **注目穴**の関係馬であり、かつ **軸馬候補（Top3）** でもある馬 |

注目穴帯は `HOT_SCORE_MIN`〜`HOT_SCORE_MAX`（半開区間）。C3: ticket 最適帯。70以上は抑えへ。scoreMin（既定60）とは独立。  
軸・超注目は買い目ラベルではなく **馬ラベル**（出走表・ボードの印／列で表示）。

### 5.3.1 レース期待度（S〜D）

レース単位で、通過した注目穴候補の質から算出する（S が最上）。**2026-08-06 再キャリブ:** 件数ボーナスをやめ、開催日内の相対順位にする（件数が多くても S に膨張しない）。

```
edge = topScore*0.75 + min(highCount,3)*10 - max(0, pickCount-3)*4
  highCount = スコア≥70 の候補数

開催日の「候補あり」レースを edge 降順:
  上位 ≈12% → S（かつ highCount≥1）
  累積 ≈32% → A
  累積 ≈57% → B
  残り候補あり → C
  候補なし → D
```

単レースのみ見える場合の絶対フォールバック: S は `edge≥84 ∧ high≥2 ∧ n≤6 ∧ top≥78`、A≥70 / B≥55 / C≥40。  
一覧・詳細・日記集計は日内相対を使う。根拠: `loop/reports/expectation-rank-sweep.json`（S ticketP +3.1pp）。

### 5.4 検証の考え方（後続）

詳細は **[DATA-AND-LOOP.md](./DATA-AND-LOOP.md)**（データ選別＋予想→結果の改善ループ）。  
開催日結果に基づく改善棚卸しは **[IMPROVEMENT-PLAN.md](./IMPROVEMENT-PLAN.md)**。

要約:

- **正解集合:** 発走前オッズ ≥ 閾値 かつ当該券種が的中した買い目
- **指標:** 再現率・適合率・候補密度（任意で仮想回収率）。日記の実回収率は別レーン
- **運用:** 発走前候補スナップを固定し、確定結果と突合。週次で **変更は1つだけ**（閾値 → 合成 → 重み → 因子定義 → Scorer）
- **データ方針:** Need×Auto を最優先。factors は当面 Derive（仮）。Manual（パドック・予想家など）は選別スコアに混ぜない

### 5.5 軸馬候補・超注目馬

穴（複勝圏）と軸（1着）を **別スコア**で予測する。`placePotential` の上位流用はしない（複勝向き馬が軸に混ざるため）。

#### 目的

- 軸馬候補と注目穴を併記し、利用者が **軸×穴** で高配当期待値の高い買い目を組みやすくする
- 穴が1着候補にも入る場合は **超注目馬** として強調する
- **初期は買い目の自動コンボ生成（券種×組み合わせ一覧）は作らない**（印・列・短評までの提示）

#### スコア分離

```
Scorer 出力:
  placePotential  … 1〜3着見込み（現行・穴用）
  winPotential    … 1着特化（新・軸用）
```

| 因子の扱い（方針） | 穴（place） | 軸（win） |
|--------------------|-------------|-----------|
| formSignal / 前走 | 複勝圏到達 | **勝ち切れ**（前走着順・着差等）を厚く |
| courseFit | 同条件の安定 | 同条件の**勝ち実績**を厚く |
| paceFit | 展開で食い込む | **展開の主導権** |
| valueGap | 人気乖離で加点 | 人気と実力の整合（逆転しすぎない） |
| 単勝オッズ | 高いほど穴向き | **上限ゲートなし**。**人気を強くブレンド**。Top3 に中穴が無いとき、**6〜10人気を条件付きで3枠目差し替え**（適性合成≥65／前走複勝圏／同条件ベストタイムがレース内上位20%。スコアが3位に近いこと。11+は対象外） |

重みは place / win で **別テーブル**。当面はルール＋仮スコア。差し替え可能な Scorer に閉じる（§5.2 と同じ）。
人気事前の根拠: TFJV `Race Results2000.csv`（2000-01〜2026-07・91645R）で1着の約65%が人気Top3、6〜10人気が約16%、11人気以下は約2.8%。短窓2026-01〜08も同水準。
中穴昇格は人気軸のカバーを大きく落とさない範囲（3枠目のみ）に限定。

#### 軸の選定ルール（確定）

```
axisCandidates(race) =
  race.horses を winPotential 降順で並べ、上位 min(3, 出走頭数) 頭
```

| 項目 | 決定 |
|------|------|
| 頭数 | **Top3** まで |
| 単勝オッズ上限 | **なし** |
| オッズゲート | 不要（本命〜中穴が軸になりうる） |
| `axisMin` 絶対閾値 | 初期は設けない（Top3 のみ）。密度が荒れたら後続で追加可 |

同点時は単勝オッズ昇順（人気寄り）で安定させる、などタイブレークは実装時に1つ決める。

#### 超注目馬

```
超注目馬 ⇔ その馬が「注目穴」候補の関係馬に含まれる
           AND その馬が軸馬候補（winPotential Top3）
```

抑え候補のみ・見送りのみでは超注目にしない。

#### ドメイン API（案）

```ts
selectAxisHorses(race: Race): AxisHorsePick[]
// AxisHorsePick: { raceId, horseNumber, winPotential, rankInRace: 1|2|3, isSuperWatch: boolean }

// 既存
selectLongshots(races, settings): LongshotPick[]
```

`isSuperWatch` は `selectLongshots` 結果（注目穴）と軸 Top3 の交差で付与してよい。

#### 検証（ループ）

| 対象 | 正解 | 指標 |
|------|------|------|
| 軸馬候補 | 実際に **1着** | 馬単位の Recall / Precision（Top3 命中率） |
| 超注目馬 | **1着**（主）／ ≤3着（副） | 件数少なめなので日次より週次 |
| 注目穴 | 現行どおり（関係馬 ≤3着 参考 ＋ ticketPrecision 主） | [HIT-RATE-PLAN.md](./HIT-RATE-PLAN.md) |

発走前 freeze に軸 Top3・超注目フラグを保存し、evaluate で突合する（詳細は [DATA-AND-LOOP.md](./DATA-AND-LOOP.md) へ後続追記）。

#### 初期にやらないこと

- 軸×穴の **自動コンボ生成**（馬連・ワイド等の買い目列挙）
- 軸だけで本命予想サイト化する UI
- 軸スコアを journal から直接学習

コンボ生成は、軸・超注目の表示と検証が回った **後続 Phase** で検討する。  
3連系（3連複／3連単を**別研究**）の製品化レーンは **[TRIFECTA-LAB.md](./TRIFECTA-LAB.md)**（§5.5 X4 の後継）。

#### 実装フェーズ（軸・超注目）

| Phase | 内容 | 完了条件 |
|-------|------|----------|
| X0 | 本節の方針反映（本ドキュメント） | 用語・ルールが文書化済み |
| X1 | `winPotential` + `selectAxisHorses` + 超注目判定 | レース単位で軸 Top3・超注目が取れる |
| X2 | UI（出走表の印、ボードの軸／超注目列） | 軸と穴を同時に見極められる |
| X3 | freeze / evaluate に軸・超注目を載せる | Top3 の1着率が週次で出る |
| X4（後続） | （任意）軸×穴コンボ生成 | [TRIFECTA-LAB.md](./TRIFECTA-LAB.md) で方針化 |

---

## 6. サイト構成（情報設計）

### 6.1 画面一覧

| 画面 | 役割 |
|------|------|
| `/` トップ | ブランド + 今日の注目穴への導線 |
| `/longshots` 注目穴ボード | **メイン画面。** 当日 JRA 全レース・全券種の高配当候補一覧 |
| `/races` レース一覧 | **開催場ごとに全レース（1〜12R）** を表示 |
| `/races/[id]` レース詳細 | 出走表 + 券種別候補ハイライト + 根拠。**軸／超注目の印** |
| `/journal` 成績日記 | **自分の購入／参考予想家の買い目の入力・一覧・回収率** |
| `/method` 予想の見方 | フィルタ・スコア方針の説明（穴／軸／超注目・差し替え可能性も明記） |
| `/settings` | **オッズ閾値・最低スコア・券種ON/OFF** の変更 |

### 6.2 トップの役割

1. ヒーロー（ブランド）
2. **今日の注目穴**（設定閾値以上・スコア上位 N 件、券種混在可）。超注目があれば優先表示可
3. レース一覧への導線
4. 選別ロジックの要約（JRA限定・全券種・閾値可変・軸 Top3）

### 6.3 注目穴ボード（最重要）

1行あたりの表示項目:

- 会場 / R / 発走時刻（JRA）
- 券種
- 買い目（馬番・枠など）
- **軸馬（当該レースの Top3 馬番）／超注目の有無**（関係馬との交差）
- オッズ
- relatedPlacePotential（バー）
- 短評（ベース＋評価因子＋傾向。複数行可）
- レース詳細へのリンク

操作:

- ソート: スコア降順 / オッズ降順 / 発走順（超注目優先は任意）
- フィルタ: 会場・芝ダート・**券種**・閾値・（任意）超注目のみ
- 閾値変更: ボード上または `/settings` と同期

自動コンボ一覧は初期対象外（§5.5）。

### 6.4 成績日記（履歴入力 UI 案）

選別ロジックとは切り離し、**実績の記録と振り返り**を担う。初期は手動入力＋ localStorage（または JSON）。後続で CSV 取込・結果の自動突合を検討。

#### 画面構成（`/journal`）

| ブロック | 内容 |
|----------|------|
| サマリー | 期間内の投資合計・払戻合計・**回収率**・的中件数。タブまたはフィルタで「自分のみ／予想家仮想／全体」 |
| 入力フォーム | 新規履歴の追加（後述フィールド） |
| 履歴一覧 | 日付降順。的中は払戻を強調。編集・削除 |
| 内訳 | 券種別・予想家別・月別の回収率（簡易テーブルで可） |

レース詳細（`/races/[id]`）からの導線（任意・後期）:

- 「この候補を購入記録」→ 券種・買い目をプリフィルして `/journal` 入力へ
- 「参考予想として保存」→ `source: "tipster"` で保存

#### 入力フォーム項目

**共通**

| UI | 対応フィールド | 必須 |
|----|----------------|------|
| レース選択（会場・R または raceId） | `raceId` | ○ |
| 券種セレクト | `betType` | ○ |
| 買い目（自由記述＋券種別ヒント） | `selection` | ○ |
| 区分: 自分の購入 / 予想家の参考買い目 | `source` | ○ |
| メモ | `note` | — |

**`source === "self"`（自分の購入）**

| UI | 対応フィールド | 必須 |
|----|----------------|------|
| 投資額（円） | `stakeYen` | ○ |
| 購入時オッズ（任意） | `oddsAtPurchase` | — |
| 払戻（円）。未確定は空欄、外れは 0 | `payoutYen` | 集計時に必要 |
| 参考にした予想家（複数可） | `referencedTipsterIds` | — |

**`source === "tipster"`（参考予想家）**

| UI | 対応フィールド | 必須 |
|----|----------------|------|
| 予想家（既存選択 or 新規名） | `tipsterId` | ○ |
| 動画・記事 URL（任意） | `referenceUrl` | — |
| 実購入 / 予想のみ | `tipsterKind` | ○ |
| 仮想投資額（比較用。初期 100 円固定でも可） | `stakeYen` | 仮想回収率用 |

的中判定: `hit = (payoutYen != null && payoutYen > 0)`。払戻未入力は「結果待ち」とし、回収率集計から除外するか、投資のみ計上（設定で選択）。

#### 回収率の定義

```
回収率(%) = 払戻合計 ÷ 投資合計 × 100
損益       = 払戻合計 − 投資合計
```

- **全体回収率**を主表示とする（的中のみだと過大に見えるため）
- **的中買い目のみの回収率**は補助表示可
- 予想家は実額が無いことが多いため、**仮想投資（例: 1点 100 円）での比較用回収率**を出す
- 切り口: 期間・券種・予想家・`source`

#### UI 上の注意

- 選別スコア（`placePotential`）や YouTube 文字起こしと **計算上は混ぜない**（紐付け ID は持ってよい）
- 予想家の「本当の購入額」は公開がなければ扱わない（推奨買い目＋仮想投資）
- 初期はカードだらけにせず、**サマリー1つ＋フォーム＋表形式一覧**を基本とする

---

## 7. データモデル（拡張案）

```ts
type Authority = "JRA"; // 将来拡張するなら NAR 等を足すが、製品対象外

type BetType =
  | "win"
  | "place"
  | "bracket_quinella"
  | "quinella"
  | "wide"
  | "exacta"
  | "trio"
  | "trifecta";

type Horse = {
  number: number;
  bracket?: number; // 枠番（枠連用）
  name: string;
  jockey: string;
  oddsWin: number;
  oddsPlace?: { min: number; max: number };
  placePotential: number; // 複勝圏（現行スコアラー）
  winPotential?: number;  // 1着特化（軸用。Scorer 拡張）
  factors: {
    courseFit: number;
    paceFit: number;
    conditionFit: number;
    formSignal: number;
    valueGap: number;
  };
  comment: string;
};

type Race = {
  id: string;
  authority: Authority; // 常に "JRA"
  venue: string; // 東京・中山 など JRA 開催場
  raceNumber: number;
  title: string;
  distance: string;
  track: "芝" | "ダート";
  startTime: string;
  weather: string;
  condition: string;
  horses: Horse[];
  // 券種別オッズ（サンプルまたは外部取込）
  oddsBoard: OddsEntry[];
};

type OddsEntry = {
  betType: BetType;
  selection: string; // 例: "5", "5-9", "5-9-2"
  odds: number;
};

type LongshotPick = {
  raceId: string;
  betType: BetType;
  selection: string;
  odds: number;
  relatedHorseNumbers: number[];
  relatedPlacePotential: number;
  label: "注目穴" | "抑え候補";
  /** 関係馬に超注目が含まれるか（導出可） */
  hasSuperWatch?: boolean;
};

/** レース単位の軸馬（馬ラベル。買い目ではない） */
type AxisHorsePick = {
  raceId: string;
  horseNumber: number;
  winPotential: number;
  rankInRace: 1 | 2 | 3; // Top3
  isSuperWatch: boolean; // 注目穴関係馬 ∩ 軸 Top3
};

type UserSelectionSettings = {
  oddsThreshold: number; // default 20
  scoreMin: number;      // default 60
  enabledBetTypes: BetType[]; // default: 全券種
  // 軸は初期固定 Top3・オッズ上限なし。必要なら後続で axisTopN 等を追加
};

// --- 成績日記（購入・参考履歴） ---

type Tipster = {
  id: string;
  name: string;
  channelOrMedia?: string; // YouTube チャンネル名など
};

type BetSlipSource = "self" | "tipster";

type TipsterKind = "purchased" | "prediction_only";
// purchased: 本人が買ったと公開している場合
// prediction_only: 推奨・予想の公開のみ

type BetSlip = {
  id: string;
  source: BetSlipSource;
  raceId: string;
  betType: BetType;
  selection: string; // 例: "5", "5-9", "5-9-2"
  stakeYen: number; // self: 実投資。tipster: 仮想投資（比較用）。未設定時は集計除外可
  oddsAtPurchase?: number;
  payoutYen: number | null; // null = 結果待ち、0 = 外れ、>0 = 払戻
  hit?: boolean; // 導出可: payoutYen != null && payoutYen > 0
  tipsterId?: string; // source === "tipster"
  tipsterKind?: TipsterKind;
  referenceUrl?: string; // 動画・記事
  referencedTipsterIds?: string[]; // source === "self" のとき参考にした予想家
  longshotPickKey?: string; // 任意。選別候補との紐付け（raceId+betType+selection 等）
  note?: string;
  createdAt: string; // ISO8601
  settledAt?: string; // 払戻確定時
};

type JournalSummary = {
  from: string;
  to: string;
  sourceFilter: "self" | "tipster" | "all";
  stakeTotal: number;
  payoutTotal: number;
  returnRatePercent: number; // payoutTotal / stakeTotal * 100（stakeTotal=0 なら 0）
  profitYen: number; // payoutTotal - stakeTotal
  betCount: number;
  hitCount: number;
  pendingCount: number; // payoutYen === null
};

type JournalSettings = {
  excludePendingFromReturnRate: boolean; // default true（結果待ちは回収率分母に入れない）
  defaultVirtualStakeYen: number; // tipster 用。default 100
};
```

選別関数（ドメイン層）:

```ts
selectLongshots(
  races: Race[],
  settings: UserSelectionSettings,
): LongshotPick[]

selectAxisHorses(
  race: Race,
): AxisHorsePick[]  // winPotential Top3。単勝オッズ上限なし
```

成績日記の集計（ドメイン層）:

```ts
summarizeJournal(
  slips: BetSlip[],
  range: { from: string; to: string },
  sourceFilter: "self" | "tipster" | "all",
  settings: JournalSettings,
): JournalSummary
```

制約:

- `races` は JRA のみを渡す（取込時点で地方を除外）
- UI は生データ直接判定せず、この関数の結果を表示する
- スコアは `Scorer` 経由でのみ算出し、実装差し替えに耐える（`placePotential` / `winPotential`）
- **`BetSlip` は選別スコアの入力に使わない**（実績・検証・振り返り用。将来の任意分析は別途）
- 軸×穴の自動コンボ生成は初期 Domains に含めない（§5.5）

---

## 8. 技術構成（段階的）

### Phase 0（現状）

- Next.js App Router + Docker
- サンプルは **東京・阪神・京都の各12レース**（JRA・全券種 oddsBoard）
- `/longshots`・`/settings`・会場別 `/races`・`/journal` を実装済み

### Phase 1（選別の骨格）— 完了相当

- `authority: "JRA"` と券種別 `oddsBoard` をデータモデルに追加
- `selectLongshots` + `Scorer` インターフェース + ルール仮実装
- サンプルに閾値以上の各券種候補を追加
- `/longshots` と `/settings`（閾値・券種）を実装
- トップを「注目穴」中心に改修
- 会場ごとの全レース一覧・見送り表示・レース期待度 S〜D

### Phase 2（説明可能性）

- 因子内訳表示
- 券種別の見方を `/method` に記載
- 設定の永続化（localStorage 等）
- **`/journal` 成績日記（手動入力・回収率サマリー）** — 選別本体の後続でも可

### Phase 3（データ接続）

- JRA 出走表・全券種オッズの取り込み（API or CSV 日次）
- 地方競馬フィードは取り込まない／除外する
- 過去結果との突合（検証ダッシュボード）
- 成績日記: レース結果との払戻突合・CSV 取込（任意）

### Phase 4（高度化・任意）

- スコアラー差し替え（学習モデル等）
- 券種別期待値の高度表示
- **軸×穴コンボ生成**（§5.5 X4 → [TRIFECTA-LAB.md](./TRIFECTA-LAB.md)）
- 通知（候補出現時）
- 成績日記: 予想家別比較、候補からの「購入記録」プリフィル

ディレクトリ案:

```
src/
  data/                 # JRA サンプル or 取得データ
  domain/
    longshots.ts        # selectLongshots
    axis.ts             # selectAxisHorses（Top3・超注目判定）
    scoring/            # Scorer IF + ruleBased（place / win）
    betTypes.ts         # 券種定義
    journal.ts          # summarizeJournal 等
  components/
  app/
    longshots/
    journal/            # 成績日記
    settings/
    races/[id]/
```

---

## 9. 実装ロードマップ

| 順 | 項目 | 完了条件 |
|----|------|----------|
| 1 | 計画反映（本ドキュメント） | 方針 1〜4 が文書化済み |
| 2 | ドメイン層 + JRA サンプル（全券種） | `selectLongshots` が閾値・券種で動く |
| 3 | `/settings` | 閾値・最低スコア・券種ON/OFFが変えられる |
| 4 | `/longshots` | 設定に応じた候補が一覧できる |
| 5 | レース詳細ハイライト | 券種別候補が分かる |
| 6 | トップ改修 | 注目穴が第一導線になる |
| 7 | 外部データ接続 | 実オッズ（JRA・全券種）で選別できる |
| 8 | スコア差し替え | 新 Scorer を差し込める |
| 9 | `/journal` 成績日記 | 自分／予想家の買い目入力と回収率表示ができる |
| 10 | 軸馬・超注目（§5.5 X1〜X3） | `winPotential` Top3・印表示・freeze/evaluate |

---

## 10. 推奨する次の一手

**データソースはプラン C（netkeiba＋改善ループ）。JV-Link 連携は保留。** 詳細は [DATA-AND-LOOP.md](./DATA-AND-LOOP.md)。

1. 開催日運用: `fetch:jra` → 発走前 `loop:freeze` → 結果後 `loop:evaluate`  
2. 週次: Recall / Precision / 候補密度を見て閾値・重みを **1変更ずつ**  
3. （任意）Want の **前走・人気** を netkeiba から拡張（合成 factors からの脱却開始）  
4. Manual データは `/journal` に閉じる。`site:check` で整合確認  
5. **軸・超注目:** §5.5 の X1（`winPotential` + Top3）→ X2（UI 印）→ X3（ループ計測）。コンボ／3連系研究所は [TRIFECTA-LAB.md](./TRIFECTA-LAB.md)  

---

## 付録 A: 現状との差分

| 現状 | 計画後 |
|------|--------|
| 単勝中心・本命／対抗提示 | **全券種**の高配当候補選別が主機能 |
| 閾値の概念なし | **変更可能なオッズ閾値**（初期 20） |
| confidence 固定的 | **差し替え可能な placePotential** |
| 軸の概念なし／人気＝軸 | **winPotential Top3**（単勝オッズ上限なし）。穴∩軸は **超注目** |
| 開催区分なし | **JRA のみ**（地方除外） |
| 横断ビューなし | `/longshots` + `/settings` |
| 購入・実績の記録なし | **`/journal` で購入／参考買い目と回収率** |
| レース期待度なし | **S〜D（日内相対・件数ペナルティ edge）** |
| 見送り非表示 | **詳細オッズ板で見送り表示** |
| 会場横断の薄い一覧 | **会場ごとの全レース（1〜12R）** |

## 付録 B: 用語

| 用語 | 意味 |
|------|------|
| ゲート | オッズが閾値以上であることの必須条件 |
| placePotential | その馬が 1〜3着に入る見込みの仮スコア |
| winPotential | その馬が **1着**になる見込みの仮スコア（軸用。place とは別算出） |
| relatedPlacePotential | 買い目に含まれる馬のポテンシャル合成値 |
| Scorer | placePotential / winPotential を計算する差し替え可能モジュール |
| 軸馬候補 | レース内 winPotential **Top3** の馬（単勝オッズ上限なし） |
| 超注目馬 | 注目穴の関係馬かつ軸馬候補である馬 |
| 見送り | オッズゲートは通過したが最低スコア未満の買い目 |
| レース期待度 | 開催日内の穴候補の相対的な厚み（S〜D）。件数だけでは上がらない |
| BetSlip | 自分の購入または予想家の参考買い目 1 件分の記録 |
| 回収率 | 払戻合計 ÷ 投資合計 × 100（全体を主、的中のみは補助） |
| 仮想投資 | 予想家の推奨買い目を比較するため仮定する投資額（初期 100 円等） |
| 成績日記 | `/journal`。選別スコアとは分離した実績蓄積 UI |
