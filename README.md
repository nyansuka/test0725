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

# 終了済みレースの結果だけ差分更新
docker compose exec web npm run fetch:jra:results

# 自動監視（発走 + 8分後から結果を取りにいく）
docker compose up fetcher
```

`docker compose up` すると `web` と一緒に `fetcher` も起動します（90秒間隔）。

- 取得元: netkeiba 公開の出馬表 / オッズ API / 結果ページ（デモ用途）
- 反映先: `src/data/snapshots/latest.json`
- 画面は `/api/races` 経由で約1分ごとに再読込
- スコア用 factors / comment はルール付与（公開データではない）
- オッズ・結果は必ず主催者（JRA）発表と照合してください

## 補足

- 当日開催はスナップショットの実データ（例: 新潟・中京・札幌）、別日は日付切替デモ用の合成データです。
- 開催日のデフォルトは日本時間の当日（当日データが無ければ最新スナップショット日）です。
- ソース変更はボリュームマウントによりホットリロードされます。
- 画面が古い場合は `docker compose down` → `docker compose up --build` のあと、ブラウザで Ctrl+Shift+R してください（`.next` は Docker ボリュームに分離済み）。
