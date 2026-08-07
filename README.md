# UMANOTE — 高配当候補の選別デモ

Next.js + Docker で動かす、JRA 向けの穴選別デモサイトです。

## 起動方法

Docker Desktop を起動したうえで:

```bash
docker compose up --build
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

停止:

```bash
docker compose down
```

## 主な画面

| パス | 内容 |
|------|------|
| `/` | トップ（ヒーロー / 選択日の注目穴 / 会場別レース一覧） |
| `/longshots` | 注目穴ボード（開催日・全券種・閾値フィルタ） |
| `/races` | 開催日＋開催場タブの全レース（1〜12R） |
| `/races/[id]` | レース詳細（候補・見送り・カテゴリ内訳） |
| `/settings` | オッズ閾値・最低スコア・券種 ON/OFF |
| `/journal` | 購入・参考買い目の成績日記 |
| `/method` | 選別の見方 |

## データ更新（公開Webから取得）

開催日の出馬表・単複／連勝オッズ・レース結果を公開ページから取り込み、`src/data/snapshots/` に保存します。

```bash
# 全レースの出馬表＋オッズ＋結果（あるもの）
docker compose exec web npm run fetch:jra

# 未発走レースのオッズだけ差分更新
docker compose exec web npm run fetch:jra:odds

# 終了済みレースの結果だけ差分更新
docker compose exec web npm run fetch:jra:results

# 自動監視（未発走オッズ更新 + 発走8分後から結果）
docker compose up fetcher
```

### 改善ループ（日次 JSON 蓄積）

発走前オッズを固定し、候補と結果突合を `src/data/loop/` に日付ごとに残します（詳細は同ディレクトリの README）。

```bash
# 朝〜直前: オッズ取得のあと凍結＋候補保存（既存凍結は上書きしない）
docker compose exec web npm run loop:freeze

# 結果揃い後: 突合と Precision / Recall
docker compose exec web npm run loop:evaluate
docker compose exec web npm run loop:report -- 2026-07-25
```

`docker compose up` すると `web` と一緒に `fetcher` も起動します（90秒間隔でオッズ＋結果）。

- 取得元: netkeiba 公開の出馬表 / オッズ API / 結果ページ（デモ用途）
- 反映先: `src/data/snapshots/latest.json`（JST 当日スナップを優先。未来日の先取りでは上書きしない）
- ループ蓄積: `src/data/loop/{snapshots,predictions,evaluations}/`
- 画面は `/api/races` 経由で約1分ごとに再読込
- スコア用 factors / comment はルール付与（公開データではない）
- オッズ・結果は必ず主催者（JRA）発表と照合してください

## サイトチェック（整合性）

HTTP・API・短評（評価／傾向）・説明文の矛盾をまとめて検証します。PASS 時のみコミット／プッシュできます。

```bash
docker compose exec web npm run site:check
docker compose exec web npm run site:check:push   # PASS かつ変更あり → commit & push → Vercel 反映確認
docker compose exec web npm run site:verify-vercel  # 手動 push 後の本番確認のみ
```

定期実行（エージェント／ターミナルで 30 分間隔など）も同じコマンドを使います。

- 当日開催はスナップショットの実データ（例: 新潟・中京・札幌）、別日は日付切替デモ用の合成データです。
- 開催日のデフォルトは日本時間の当日（当日データが無ければ最新スナップショット日）です。
- ソース変更はボリュームマウントによりホットリロードされます。
- 画面が古い場合は `docker compose down` → `docker compose up --build` のあと、ブラウザで Ctrl+Shift+R してください（`.next` は Docker ボリュームに分離済み）。

## 成績日記（Neon）と Vercel 公開

成績日記は [Neon](https://console.neon.tech/)（PostgreSQL）に保存します。ローカルは `.env.local`、[Vercel](https://vercel.com/nanska) 本番は Project Settings の Environment Variables に同じキーを入れます。

```bash
# 初回のみスキーマ作成
npm run journal:migrate
# または
docker compose exec web npm run journal:migrate
```

| 場所 | 設定 |
|------|------|
| ローカル | `.env.local` に `DATABASE_URL=...`（Git 管理外） |
| Vercel | Settings → Environment Variables → `DATABASE_URL`（Production / Preview） |

### TFJV（Race Results）を Neon へ

週次で手動更新する過去走データ用。スキーマは journal と同じ Neon プロジェクトに同居。

```powershell
# スキーマ適用
docker compose exec -T web npm run tfjv:migrate

# 初回フルロード（空にしてから全件）※時間がかかります
docker compose exec -T web npm run tfjv:load -- --truncate

# ホストの CSV をマウントする場合
docker compose run --rm --no-deps -v "C:/TFJV/TXT:/tfjv:ro" -e TFJV_CSV="/tfjv/Race Results2000.utf8.csv" web npm run tfjv:load -- --truncate

# 動作確認（先頭5000行だけ）
docker compose run --rm --no-deps -v "C:/TFJV/TXT:/tfjv:ro" -e TFJV_CSV="/tfjv/Race Results2000.utf8.csv" web npm run tfjv:load -- --limit=5000

# 週次更新（truncate なし・upsert）
docker compose run --rm --no-deps -v "C:/TFJV/TXT:/tfjv:ro" -e TFJV_CSV="/tfjv/Race Results2000.utf8.csv" web npm run tfjv:load
```

UTF-8 変換済み CSV（`Race Results2000.utf8.csv`）を推奨。Free プランは 0.5GB 制限のため、容量超過時は Launch へ。

接続文字列は Neon の **pooled** 接続（ホスト名に `-pooler`）を推奨。チャットやリポジトリにパスワードを載せないこと。漏洩したら Neon でロールのパスワードを再発行する。

Vercel は `main` への push で再デプロイされる想定です。push 後は `site:verify-vercel`（または `site:check:push`）で https://test0725.vercel.app の `raceDate` / `fetchedAt` が `latest.json` と一致することを確認します。`DATABASE_URL` 未設定のとき成績日記はブラウザ localStorage にフォールバックします。
