# 定期運用（データ収集・突合・サイトチェック）

間隔の目安: **30分**（土日開催中の結果取り込み）。非開催日は site:check のみでも可。

## 役割分担

| 層 | 誰がやるか | 内容 |
|----|------------|------|
| 結果・オッズ更新 | GitHub Actions（自宅以外） | 土日 8–19 時 JST・30 分間隔。8:00 は full、以降は結果のみ。自宅 `fetcher` は起動しない |
| 発走前固定 | Actions 朝の full のあと | `git pull` → `loop:freeze`（薄いときだけ `--force`） |
| 定期ティック | エージェント loop | `git pull` → 突合 → trends → site:check →（PASSなら）commit/push |
| 週次改善 | 人＋エージェント | `loop:report` を見て **変更は1つだけ**（DATA-AND-LOOP §5.4） |

凍結オッズ（`loop/snapshots`）は原則触らない。サイト表示用の `src/data/snapshots/` は GitHub Actions の Refresh で更新する。

## ホスト手動

```powershell
# 朝（Actions の Refresh が終わってから git pull）
git pull
docker compose exec -T web npm run loop:freeze -- 2026-07-26

# 結果が溜まったら／夜
docker compose exec -T web npm run loop:evaluate -- 2026-07-26
docker compose exec -T web npm run loop:trends
docker compose exec -T web npm run loop:report -- 2026-07-26

# 整合チェック
docker compose exec -T web npm run site:check

# commit/push（PASS 時）＋ Vercel 本番反映確認
docker compose exec -T web npm run site:check:push
# 手動 push 後だけ確認する場合:
docker compose exec -T web npm run site:verify-vercel
```

本番 URL: https://test0725.vercel.app/  
`site:verify-vercel` はローカル `latest.json` の `raceDate` / `fetchedAt` と本番 `/api/races` が一致するまで最大約3分待つ。

## エージェント用プロンプト（30分 tick）

> `project/test0725` でプラン C 運用ティックを実行:
> 1. `git pull` して Actions が積んだ当日スナップを揃える。**自宅から `fetch:jra` / `watch:jra` しない**。スナップが古い・欠けるときだけ `gh workflow run "Refresh JRA odds"` を1回。失敗したら理由を短く
> 2. `docker compose exec -T web npm run loop:evaluate`（当日。freeze 済み前提）
> 3. `docker compose exec -T web npm run loop:trends`
> 4. `docker compose exec -T web npm run site:check`
> 5. PASS かつ未コミット変更あり → 前回作者（`GIT_AUTHOR_*`）で commit & push。続けて `npm run site:verify-vercel`（または `site:check:push`）。FAIL なら修正せず要約のみ（push しない）
> 6. 2〜3行で: 結果レース数 / Precision・Recall（出せれば）/ site-check / commit有無 / Vercel反映
>
> 注意: `loop:freeze --force` はしない（発走前固定を壊さない）。単勝が軒並み 99.9 のときだけ報告。

停止: ループ端末を止めるか「定期運用を止めて」と指示。
