# UMANOTE 地方版（NAR）構成計画書

最終更新: 2026-08-11（Phase 0 調査反映）  
**地方版リポジトリ:** [`../umanote-nar`](../umanote-nar)（計画書の正本・公式 CSV fetcher・snapshots-nar）  
親計画: [PLAN.md](./PLAN.md)（JRA・現行本番 / 本リポジトリ test0725）  
関連: [DATA-AND-LOOP.md](./DATA-AND-LOOP.md)、[SITE-CHECK.md](./SITE-CHECK.md)  
調査成果物: `tmp/nar-probe/`（gitignore 想定。再実行は `scripts/probe-nar-*.mjs`）  
※ 地方版の継続作業は `umanote-nar` 側を優先する。本ファイルは JRA リポ内の参照コピー。

---

## 1. 目的

**地方競馬（NAR 等）**を対象に、現行 UMANOTE（JRA）と同じコア価値——**高配当候補の選別**（本命探しではない）——を提供するサイト／プロダクトラインを立ち上げる。

穴馬（複勝圏ポテンシャル）と軸馬（1着見込み）を分け、穴∩軸を **超注目** として短時間で見極められる体験を、地方開催でも再現する。

本計画は **実装着手前の方針・境界・段階** を固定するものとする。JRA 現行サイト（https://test0725.vercel.app/）の安定運用を壊さないことを最優先制約とする。

---

## 2. 現行 JRA 版からの前提

| 項目 | 現状（JRA） | 地方版への含意 |
|------|-------------|----------------|
| 製品名 | UMANOTE | ブランド継続かサブラベル（例: UMANOTE 地方）は後述の未確定事項 |
| 対象 | JRA 全レースのみ。地方は明示的に対象外 | 別 Authority / 別カタログが必要 |
| データ | netkeiba 公開ページ + `api_get_jra_odds` → `src/data/snapshots/` | **別 fetcher・別 snapshot ツリー**が必須 |
| 型 | `Authority = "JRA"` のみ。選別は JRA ゲート | `"NAR"`（または地域主催）を追加し、フィルタを分離 |
| 券種 | JRA 8券種（枠連含む） | 会場・主催により券種が異なる。データ駆動にする |
| 開催形 | 概ね 3場 × 12R | 地方は 1場少頭数〜複数場混在。**12R前提のコピーを捨てる** |
| スコア | ルール＋仮スコア / Scorer 差し替え可 | インターフェース再利用。重み・事前分布は **NAR 用に再較正** |
| 改善ループ | freeze → evaluate → trends | パターン再利用。ベースラインは別計測 |
| 本番 | Vercel + `site:verify-vercel` | 同一デプロイか別プロジェクトかは未確定（§6） |

---

## 3. 確定したい方針（提案）

実装前に次を「決定」または「暫定決定」する。表の「提案」は推奨案。

| # | 論点 | 提案 | 理由 |
|---|------|------|------|
| 1 | 製品形態 | **同一リポジトリ・Authority 分離**（段階的）。初期は NAR カタログを別 snapshot に置き、UI で開催切替 or 別ルート | ドメイン／UI／ループの再利用が最大。JRA 本番を壊しにくい |
| 2 | デプロイ | **Phase 0–1 は同一アプリ内の NAR 面**、安定後に必要なら別 Vercel プロジェクト | 運用コストと検証スクリプトの二重化を遅らせる |
| 3 | データソース（当面） | **公式 CSV（keiba.go.jp）＋ nar.netkeiba enrich**（Phase 0 暫定決定） | 全賭式の中間オッズは公式 ZIP が正本。馬ID・出馬表見た目は nar |
| 4 | コア価値 | JRA と同じ（オッズゲート → placePotential → 軸／超注目） | プロダクト言語を共通化し学習コストを下げる |
| 5 | 券種 | **スナップショットに存在する券種のみ**を有効化。枠連は会場で無い／意味が違う場合は非表示 | JRA 全券種ハードコードを避ける |
| 6 | スコア | Scorer インターフェース共有、**NAR 用実装 or 設定プロファイル** | TFJV 等 JRA 事前分布は流用しない |
| 7 | 日記 | スキーマ共有。`raceId` / `authority` で分離集計 | Neon 二重化を避ける |

未確定（後続で決める）:

- ブランド表記（UMANOTE 一本 vs 「地方」サブラベル）
- 対象会場の初期範囲（南関東4場のみ / 全 NAR / ユーザー選択）— **提案維持: 南関東4場**
- ~~データソースの確定ベンダー~~ → **Phase 0 で暫定決定（§17）**: 公式 CSV（オッズ）＋ nar.netkeiba（出馬表・結果・馬ID）
- 同一 URL 上の切替 UI vs `/nar` サブパス vs 別ホスト
- JV-Link / 有料 API の導入時期（JRA 側と同様 Later）

---

## 4. 成功の定義

次を満たせば「地方版として選別できる」状態とする。

| # | 条件 |
|---|------|
| A | 対象日・対象会場のレースについて、存在する券種で「オッズ ≥ 閾値」の候補を一覧できる |
| B | 候補関係馬の複勝圏ポテンシャルと、軸（winPotential TopN）／超注目が見られる |
| C | なぜ候補にしたかの根拠（短評・指標）が表示される |
| D | 当日の **対象地方開催** 横断で候補をまとめて確認できる |
| E | オッズ閾値・最低スコア・券種トグルを画面上で変更できる |
| F | JRA 本番の `latest.json` 反映・`site:verify-vercel` を壊さない |
| G | 結果突合可能な `raceId` / `sourceRaceId` で改善ループの1周が回る |

補足: 的中保証は対象外。デモ／検証用の選別ロジックとして扱う（JRA 版と同じ）。

---

## 5. やること／やらないこと

### 5.1 やること（初期〜中期）

- `Authority` を `"JRA" | "NAR"` に拡張し、選別・一覧・期待度を Authority フィルタ対応にする
- NAR 用 fetcher（例: `fetch:nar` / `watch:nar`）と `src/data/snapshots-nar/`（仮称）
- 会場マスタ（コード・slug・表示名・券種セット・枠制の有無）
- 券種・レース数・頭数を **データ駆動** にした UI コピー修正
- NAR 用 Scorer プロファイル（または別モジュール）とゲートバイアス再定義
- 成績日記の Authority フィルタ／集計分離
- 地方版用の site-check アサーション（JRA 文言を誤って要求しない）

### 5.2 やらないこと（初期）

- JRA fetcher（`api_get_jra_odds` 等）への NAR 無理載せ
- JRA と NAR の候補を **同一ボードに無区別混在**させること（誤認防止）
- 自動投票・自動購入
- 軸×穴の買い目自動コンボ生成（JRA 同様、印・併記まで）
- JRA 向け TFJV 事前分布のそのまま適用
- 全地方場の初日から同時カバー（段階導入）
- リアルタイム超高頻度更新（スナップショット＋ポーリング方針を踏襲）

---

## 6. 製品形態の選択肢

| 案 | 概要 | 利点 | 欠点 | 推奨段階 |
|----|------|------|------|----------|
| **A. 同一アプリ・Authority 切替** | 日付＋中央/地方の切替。カタログは別ファイル | 再利用最大・1デプロイ | バグが相互影響しうる | **Phase 1 推奨** |
| **B. サブパス `/nar`** | ルート分離、共有コンポーネント | 認知的分離が明確 | ナビ・設定の二重管理 | A の変形として可 |
| **C. 別リポジトリ／別 Vercel** | `umanote-nar` 完全分離 | 本番隔離 | 二重メンテ | 規模・規制が増えたら |

**推奨:** 当面は **案 A（必要なら B）**。JRA の `authority === "JRA"` ゲートは維持し、NAR 面は `authority === "NAR"` のみを読む。

---

## 7. ドメイン差分（JRA → NAR）

### 7.1 会場・ID・開催形

| 概念 | JRA | NAR（想定） |
|------|-----|-------------|
| 会場 | 10場固定 | 大井・川崎・船橋・浦和・門別・盛岡・園田 等。マスタ拡張が必須 |
| race ID | netkeiba 12桁＋内部 slug | ソース依存。`sourceRaceId` と内部 `id` の規約を新規定義 |
| 1日の形 | 〜3場×12R | 場数・R数が可変。UI は `raceCount` / venues 配列ベース |
| 枠 | 標準8枠前提の箇所あり | 枠連無し・枠制差がある場は **枠連オフ＋バイアス無効化** |
| クラス表記 | 未勝利／1勝クラス等 | 各場・グレード表記が異なる。表示は文字列、スコアは粗く |

### 7.2 券種

初期は「取得できた券種だけ有効」。想定マッピング:

| コード | 扱い |
|--------|------|
| `win` / `place` | 原則必須 |
| `quinella` / `wide` / `exacta` / `trio` / `trifecta` | 場・日により存在。無いものは設定トグル非表示 |
| `bracket_quinella` | NAR ではデフォルト無効。マスタで有効場のみ |

設定デフォルトは JRA と別プロファイル（例: `DEFAULT_SETTINGS_NAR`）を持つ。

### 7.3 スコア・事前分布

- `Scorer` 差し替え口は流用
- `popularityPrior` / TFJV 由来の JRA 統計は **使わない**
- `trackGateBias` は会場マスタに紐づく設定へ（無い場は因子0）
- 地方特有の因子候補（後続）: ダート偏重・ローカル騎手／調教師・転入馬・短距離偏り等（Want）

### 7.4 型拡張案

```ts
type Authority = "JRA" | "NAR";

type VenueProfile = {
  code: string;
  name: string;       // 表示名
  slug: string;
  authority: "NAR";
  region?: string;    // 南関東 / 北海道 等（フィルタ用）
  supportsBracketQuinella: boolean;
  defaultEnabledBetTypes: BetType[];
};
```

`Race.authority` は常に明示。選別関数は呼び出し側で Authority を固定する（混在配列を渡さない）。

---

## 8. データ取得アーキテクチャ

### 8.1 目標フロー

```
公開Web（地方出馬表 / オッズ / 結果 / 馬成績）
    → scripts/fetch-nar-snapshot.mjs (+ watch-nar-snapshot.mjs)
    → src/data/snapshots-nar/{YYYY-MM-DD,latest}.json
    → loadRaceCatalog({ authority: "NAR" })
    → RaceCatalogProvider（または NarCatalogProvider）
    → selectLongshots / selectAxisHorses / Scorer(NAR)
```

JRA の `snapshots/` と **ファイルツリーを分離**し、`latest.json` の上書き競合を防ぐ。

### 8.2 Need × Auto（地方版で最初に揃えるもの）

| データ | 用途 |
|--------|------|
| 開催日・会場・R・発走 | 一覧・横断 |
| raceId / sourceRaceId | 突合 |
| 芝ダ・距離・条件名 | 表示・適性（粗） |
| 出走馬（馬番・枠?・馬名・騎手） | 候補・結果 |
| 単勝・複勝オッズ | ゲート |
| 取得可能な組み合わせ券（間引きルールは JRA に準拠しつつ閾値連動） | 全有効券種ゲート |
| 確定着順・払戻 | 検証・日記 |

### 8.3 取得の注意

- JRA 専用パス（`api_get_jra_odds.html` 等）は流用しない
- HTML セレクタ・レース ID 体系はソース調査のうえ **NAR 専用パーサ**に閉じる
- 公式（各場・NAR）との照合は運用ルールとして残す（一次スクレイプは公開 Web）
- robots / 利用規約・負荷（ポーリング間隔）は JRA と同水準以上に慎重に

### 8.4 初期カバー範囲（提案）

| Phase | 会場 | 理由 |
|-------|------|------|
| P1 | 南関東4場（大井・川崎・船橋・浦和） | 情報密度・券種・知名度で検証しやすい |
| P2 | 主要地方（門別・盛岡・園田・高知 等） | 需要とデータ安定性で追加 |
| P3 | その他 NAR | マスタ駆動で拡張 |

ユーザーが会場をオフにできるフィルタは P1 から用意する。

---

## 9. UI / UX

### 9.1 再利用

- ロングショットボード、レース詳細、設定、メソッド説明の **構造**
- 日記パネル
- ヘッダー／日付バーのパターン（ラベルだけ差し替え）

### 9.2 変更必須

- 「JRA 全券種」「中央競馬」等のコピーを Authority 依存にする
- ヒーロー・フッターの対象明示（誤って中央と混同しない）
- 会場順・グループ化を `VenueProfile` ベースに
- デモ合成データは NAR 用に別途（または NAR 面では合成なしでスナップショット必須）

### 9.3 切替 UX（案 A）

- ヘッダーまたは開催日バーに **中央 / 地方** トグル
- 設定はプロファイル別（localStorage キーを分ける）
- 日記は「すべて / 中央 / 地方」フィルタ

---

## 10. 選別ロジック

ゲート（案）:

```
candidate.odds >= oddsThreshold
candidate.betType ∈ enabledBetTypes ∩ availableBetTypes(race)
candidate.race.authority === "NAR"
```

- Soft Score / 軸 / 超注目 / レース期待度 S–D の **定義は共通**
- 閾値デフォルトは NAR のオッズ分布を見て再設定（JRA の 25/80/60 を盲従しない）
- ラベル帯（注目穴 65–70 等）もループで再較正

---

## 11. 改善ループ・運用

| 項目 | 方針 |
|------|------|
| freeze / evaluate / trends | `src/data/loop-nar/`（仮称）に分離。指標定義は共有可能 |
| npm scripts | `fetch:nar`, `watch:nar`, `loop:nar:*`, `site:check:nar` |
| GitHub Action | JRA `refresh-odds.yml` とは **別 workflow**（スケジュール・パスを分離） |
| Vercel 検証 | 案 A の間は `/api/races?authority=NAR` 等を追加検証。JRA の `site:verify-vercel` は現状維持 |
| Docker | `fetcher-nar` サービス追加、または同一 fetcher のモード切替 |

JRA の「push 後は `site:verify-vercel`」ルールは継続。NAR スナップショットだけの変更でも、現行ルールどおり latest 一致の煙テストは有効。

---

## 12. 段階計画

### Phase 0 — 調査・スパイク（完了 2026-08-11）

- データソース候補の HTML/API 契約調査 → **§17**
- 南関東1場×1開催日の手動スナップショット試作（浦和 2026-08-07）
- 券種・枠・頭数の差分表 → **§17.3**
- 会場マスタ草案（4場）→ **§17.4**

**完了条件:** 「このソースで Need×Auto が埋まる」と判断できる／代替ソースが決まる。 → **達成（公式 CSV＋nar ハイブリッド）**

### Phase 1 — MVP（南関東）

- `Authority` 拡張と選別ゲート
- `fetch:nar` + `snapshots-nar/` + カタログ読み分け
- 最小 UI（ロングショット＋レース詳細＋設定プロファイル）
- 中央/地方の混同が起きないコピー
- 結果取得と1周分の evaluate

**完了条件:** 成功定義 A–E, F, G の骨格。本番で NAR 面が開ける（フィーチャーフラグ可）。

### Phase 2 — 運用品質

- `watch:nar`、GitHub Action、site-check:nar
- 馬フォーム enrich、日記 Authority 集計
- Scorer 再較正・閾値スイープ（HIT-RATE 系の地方版メモ）
- 会場追加（P2）

### Phase 3 — 拡張

- 全 NAR マスタ、地域フィルタ、（必要なら）別ホスト分離
- Want 因子（転入・ローカル騎手等）
- 有料フィード検討

---

## 13. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 公開ページ構造変更・利用制限 | 取得停止 | パーサ隔離、公式照合手順、代替ソース調査を Phase 0 で実施 |
| JRA/NAR データ混線 | 誤選別・誤デプロイ | snapshot ツリー分離、Authority 必須、latest 更新条件を別関数に |
| 枠連・8枠前提の残存 | 不正スコア | マスタフラグで無効化、テストに NAR フィクスチャ |
| オッズ分布差 | 閾値・密度が破綻 | NAR 専用デフォルト＋スイープ |
| 運用二重化 | メンテ負荷 | 当面同一リポ・スクリプト命名規則の統一 |
| 法務・利用規約 | 取得停止要請 | 公開情報の範囲に限定、過度な頻度を避ける |

---

## 14. リポジトリ変更の見通し（ファイル単位の目安）

| 領域 | 追加・変更の目安 |
|------|------------------|
| `src/domain/types.ts` | `Authority` 拡張、VenueProfile |
| `src/domain/longshots.ts` 等 | Authority フィルタの明示化 |
| `src/domain/scoring/` | NAR プロファイル or 実装 |
| `src/data/snapshots-nar/` | 新規 |
| `src/data/loadCatalog.ts` | authority 引数 |
| `scripts/fetch-nar-snapshot.mjs` 等 | 新規（JRA スクリプトは触らない方針） |
| `src/app/**` | 切替 UI・コピー・必要なら `/nar` |
| `docs/PLAN.md` | 「地方は対象外」→「地方は NAR-PLAN 参照」へ更新 |
| `.github/workflows/` | NAR 用 workflow 追加 |

JRA の `fetch-jra-snapshot.mjs` / 現行 `snapshots/latest.json` の契約は **破壊しない**。

---

## 15. オープンクエスチョン（決定ログ用）

実装キックオフ前に埋める。

| # | 問い | 状態 | メモ |
|---|------|------|------|
| 1 | 初期会場は南関東4場でよいか？ | **提案維持** | 浦和でスパイク成功。4場マスタ草案は §17.4 |
| 2 | 同一 URL 切替か `/nar` か？ | 未決 | |
| 3 | データソースの第一候補は何か？ | **暫定決定** | 公式 ZIP/CSV（オッズ・レース）＋ nar.netkeiba（出馬表・結果・馬ID）。詳細 §17 |
| 4 | ブランドは「UMANOTE」共通か、地方専用名か？ | 未決 | |
| 5 | Phase 1 を本番公開するか、フラグ裏に置くか？ | 未決 | |
| 6 | 日記を中央/地方で予算・回収率を分けるか、合算デフォルトか？ | 未決 | |
| 7 | `枠単` を BetType に追加するか？ | **決定: 入れる** | コード `bracket_exacta`。公式・nar 双方に存在 |

---

## 16. 次のアクション

| 優先 | アクション | 成果物 | 状態 |
|------|------------|--------|------|
| 1 | Phase 0 スパイク（1場1日） | 試作 JSON + 取得可否メモ | **完了**（浦和 2026-08-07、§17） |
| 2 | §15 の残り決定 | 本表を更新 | 枠単は決定。他は未着手 |
| 3 | 公式 CSV → Race[] 変換スパイク | `fetch:nar:official` | **完了**（`src/data/snapshots-nar/`） |
| 4 | `Authority` 拡張の小さい変更 | 型＋選別ゲート | 型は拡張済。選別ゲートはまだ JRA のみ |
| 5 | `fetch:nar` MVP（enrich 含む） | horseId マージ等 | 未着手 |
| 6 | NAR 面の最小画面 | 成功定義 A–E のデモ | 未着手 |

---

## 17. Phase 0 調査結果（2026-08-11）

### 17.1 結論（Need × Auto は埋まる）

**「このソースで Need×Auto が埋まる」→ Yes（ハイブリッド）。**

| 役割 | 第一候補 | 根拠 |
|------|----------|------|
| 当日レース一覧・頭数・条件 | **keiba.go.jp 公式 CSV**（`racelist` / `horselist`） | ログイン不要で ZIP 取得可。会場名が日本語で安定 |
| 中間オッズ（全賭式） | **keiba.go.jp 公式 CSV**（`odds`） | 単勝〜3連単＋**枠単**。約2分更新（公式マニュアル） |
| 払戻 | 公式 `payback.csv` および／または nar 結果ページ | 公式に枠単欄あり |
| 出馬表の見た目・馬ページ ID | **nar.netkeiba.com** shutuba | `db.netkeiba.com/horse/{id}` が取れる（フォーム enrich 用） |
| 単勝の簡易ポーリング | `api_get_nar_odds`（`odds_status=real` 時） | 発売後／確定後は馬番キー。**type では券種切替できない** |
| 組み合わせ券（netkeiba） | `/odds/?type=b3..b9` HTML | 確定後は券種ごとに異なる表。selection パースは要作り込み |

JRA の `api_get_jra_odds` に NAR の `race_id` を渡すと `empty free odds schedule` で NG。流用不可。

### 17.2 URL / ID 契約

#### race_id（nar.netkeiba・12桁）

```
YYYY + venue(2) + MMDD + RR
例: 202642080701 = 2026年 / 浦和(42) / 08-07 / 1R
```

#### 一覧

```
https://nar.netkeiba.com/top/race_list_sub.html?kaisai_date=YYYYMMDD
```

#### 出馬表 / 結果 / オッズ HTML

```
https://nar.netkeiba.com/race/shutuba.html?race_id={id}
https://nar.netkeiba.com/race/result.html?race_id={id}
https://nar.netkeiba.com/odds/?race_id={id}&type=b1   # 単勝・複勝（発売前は「予想オッズ」表示）
type=b3 枠連 / b9 枠単 / b4 馬連 / b5 ワイド / b6 馬単 / b7 3連複 / b8 3連単
```

#### オッズ API（制限つき）

```
https://nar.netkeiba.com/api/api_get_nar_odds.html?type=1&race_id={id}&is_ajax=1&action=init
```

| `odds_status` | 形 | 意味 |
|---------------|-----|------|
| `yoso` | `ary_odds.KettoNum[{血統登録番号}].Odds` | **予想オッズ**。type を変えても同じ |
| `real` | `ary_odds["01".."N"].Odds/Ninki` | **実オッズ（単勝相当）**。type 1–9 も同じ単勝形 |

券種可用性チェック:

```
https://nar.netkeiba.com/odds/ajax_get_odds.html?func=check&race_id={id}
→ {"status":"OK","data":{"1":true,...,"9":true}}  # 9=枠単。発売前は NG のことも
```

#### 公式ダウンロード（ログイン不要・確認済）

```
https://www.keiba.go.jp/KeibaWeb/DataDownload/RaceDataDownload?type=daily
→ YYYYMMDD_{ts}_race.zip  (racelist / horselist / payback)

https://www.keiba.go.jp/KeibaWeb/DataDownload/OddsDataDownload?type=daily
→ YYYYMMDD_{ts}_odds.zip  (odds.csv)
```

説明書: https://www.keiba.go.jp/pdf/manual/data_pdf_manual.pdf

`odds.csv` 列: `競馬場,競走年月日,レース番号,賭式,番号1,番号2,番号3,オッズ,オッズ（最大）,人気`  
賭式例: 単勝 / 複勝 / 枠複 / 枠単 / 馬複 / ワイド / 馬単 / ３連複 / ３連単

観測（2026-08-11 昼）: オッズ ZIP は **発売中・公開中のレースに偏る**（全日全場が常に埋まっているとは限らない）。fetcher は欠損を許容し、発走接近で埋まる前提でポーリングする。

### 17.3 券種・枠・頭数の差分表

| 項目 | JRA（現行） | NAR（観測） |
|------|-------------|-------------|
| 単勝・複勝 | あり | あり |
| 枠連 | あり（`bracket_quinella`） | あり（公式: 枠複、HTML: b3） |
| **枠単** | 製品型に無し | **あり**（公式: 枠単、HTML: b9）。Phase 1 で型追加か無視かを決める |
| 馬連・ワイド・馬単・3連複・3連単 | あり | あり |
| 1日の R 数 | 概ね場あたり 12 | 場あたり **可変**（例: 金沢10、笠松11、浦和12） |
| 頭数 | 多め固定感 | **7〜12** など場・Rで変動（浦和 2026-08-11: 7–12） |
| 芝／ダ | 芝・ダ混在 | 南関東は **ダート偏重**（スパイクでもダのみ） |
| クラス表記 | 未勝利・1勝クラス等 | C2・C3・2歳二等の地方表記 |
| 発売前オッズ | JRA API で実オッズ寄り | netkeiba は **予想オッズ**になりやすい → ゲート用途には公式 CSV を優先 |

南関東（浦和）確定レースの払戻表記には単勝〜3連単に加え **枠連・枠単** が含まれることを HTML で確認。

### 17.4 会場マスタ草案（Phase 1 初期）

netkeiba venue code（race_id の 5–6 桁目）:

| code | 表示名 | slug | region | 枠連 | 枠単 | Phase |
|------|--------|------|--------|------|------|-------|
| 42 | 浦和 | urawa | 南関東 | yes | yes | **P1** |
| 43 | 船橋 | funabashi | 南関東 | yes* | yes* | **P1** |
| 44 | 大井 | oi | 南関東 | yes* | yes* | **P1** |
| 45 | 川崎 | kawasaki | 南関東 | yes* | yes* | **P1** |
| 30 | 門別 | monbetsu | 北海道 | TBD | TBD | P2 |
| 35 | 盛岡 | morioka | 東北 | TBD | TBD | P2 |
| 36 | 水沢 | mizusawa | 東北 | TBD | TBD | P2 |
| 46 | 金沢 | kanazawa | 北陸 | TBD | TBD | P2 |
| 47 | 笠松 | kasamatsu | 東海 | TBD | TBD | P2 |
| 48 | 名古屋 | nagoya | 東海 | TBD | TBD | P2 |
| 50 | 園田 | sonoda | 兵庫 | TBD | TBD | P2 |
| 51 | 姫路 | himeji | 兵庫 | TBD | TBD | P2 |
| 54 | 高知 | kochi | 四国 | TBD | TBD | P2 |
| 55 | 佐賀 | saga | 九州 | TBD | TBD | P2 |

\* 南関東は同一賭式セットと見て初期 yes。場ごとの欠落は `ajax_get_odds?func=check` / 公式 CSV の出現で上書き。

公式 CSV の `競馬場` は漢字名（「浦和」「大井」）。fetcher は **名前→code/slug** の逆引き表を持つ。

### 17.5 スパイク成果物

| 成果 | パス |
|------|------|
| 浦和全日試作スナップショット | `tmp/nar-probe/snapshots/2026-08-07-urawa.json`（12R、authority=NAR、単勝＋組合せ HTML） |
| ソース調査レポート | `tmp/nar-probe/phase0-source-conclusion.json` ほか |
| 公式当日 ZIP サンプル | `tmp/nar-probe/official_race_daily.bin` / `official_odds_daily.bin` |
| 再実行スクリプト | `scripts/probe-nar-source.mjs`, `probe-nar-combo-odds.mjs`, `probe-nar-odds-shape.mjs`, `probe-keiba-go-download.mjs`, `build-nar-probe-snapshot.mjs` |

試作で確認できたこと:

- 出馬表 HTML の `RaceName` / `RaceData01` / `HorseList` は JRA に近く、既存パーサの移植が現実的
- 頭数は 8–12 で可変
- 組合せボードは HTML から件数を積める（selection 正規化は Phase 1 で公式 CSV 優先が安全）
- 結果ページの着順パースは Phase0 では未完成（`finishes=[]`）。払戻ラベル抽出のみ成功 → **公式 payback / 結果パーサ改善が Need**

### 17.6 Phase 1 への推奨アーキテクチャ（更新）

```
keiba.go.jp daily ZIP (race + odds + payback)
    → scripts/fetch-nar-official-snapshot.mjs
    → src/data/snapshots-nar/{date,latest}.json
nar.netkeiba shutuba (optional enrich: horseId)
    → merge by (venueName, raceDate, raceNumber)  # 未実装
```

実装済み（2026-08-11）:

- `npm run fetch:nar:official`（既定 `--venues=南関東`）
- `npm run fetch:nar:official:all`
- `bracket_exacta`（枠単）を `BetType` / 設定 UI / 選別の枠解決に追加
- `Authority = "JRA" | "NAR"`（スナップショットは NAR で出力。**選別関数は当面 JRA のみ処理**）

- ゲート用オッズの正本は **公式 CSV**
- netkeiba API の yoso はスコア補助にも使わない（実オッズと混同しやすい）
- `枠単` は製品に含める（決定）

### 17.7 残リスク（Phase 0 時点）

| リスク | 対策 |
|--------|------|
| 公式オッズ ZIP が一部レースのみ | ポーリング間隔を短く（公式は〜2分）。欠損レースはボード空でよい |
| netkeiba スクレイプ制限 | 公式を主、enrich のみ低頻度 |
| 結果着順パーサ未完成 | 公式 payback + horselist 着順列を正本候補に |
| 枠単の製品扱い | §15-7 で決定 |

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-08-11 | 初版。JRA 現行（test0725 / UMANOTE）を前提に地方版の方針・段階・差分を定義 |
| 2026-08-11 | Phase 0 調査反映。公式 CSV＋nar.netkeiba のハイブリッドを暫定決定。会場マスタ・券種差分・スパイク結果を追記 |
| 2026-08-11 | 枠単を製品に入れると決定。`bracket_exacta` 追加。公式 CSV→`snapshots-nar` 変換（`fetch:nar:official`）を実装 |
