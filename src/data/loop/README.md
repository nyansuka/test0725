# 改善ループ用日次 JSON

発走前オッズ・候補・結果突合を日付ごとに蓄積する。DB は使わない。

| パス | 内容 | 上書き |
|------|------|--------|
| `snapshots/YYYY-MM-DD.json` | 発走前の出走・オッズ板（結果なし） | **初回のみ**（以降スキップ） |
| `predictions/YYYY-MM-DD.json` | 当時設定の `selectLongshots` 候補 | freeze のたびに更新可 |
| `evaluations/YYYY-MM-DD.json` | 的中突合と Precision / Recall 等 | evaluate のたびに更新 |
| `trends/latest.json` | 短評用の券種・会場などの傾向 | evaluate / `loop:trends` で再生成（**Git 管理**） |
| `reports/report-*.json` | 複数日のメトリクスまとめ | 都度新規（ローカルのみ） |

`evaluations` / `predictions` / `snapshots` はサイズが大きいため `.gitignore` 対象。短評に必要な傾向は `trends/latest.json` をコミットする。

## 使い方

開催日の朝〜直前（オッズが揃ったあと）:

```bash
docker compose exec web npm run fetch:jra
docker compose exec web npm run loop:freeze
# 日付指定: npm run loop:freeze -- 2026-07-25
```

結果が揃ったあと（または fetcher が更新したあと）:

```bash
docker compose exec web npm run loop:evaluate
docker compose exec web npm run loop:report -- 2026-07-25
```

閾値を変えて予測だけ作り直す（凍結オッズは触らない）:

```bash
docker compose exec web sh -c "ODDS_THRESHOLD=30 SCORE_MIN=55 npm run loop:freeze"
```

## 注意

- **freeze は結果が出る前に一度実行する。** 既存の `loop/snapshots` は上書きしない。
- ライブの `src/data/snapshots/` は fetcher が結果で更新してよい。検証のオッズは常に `loop/snapshots` を使う。
- factors が合成のあいだ、指標は「製品の挙動」評価である。
