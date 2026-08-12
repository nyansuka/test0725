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
# 薄い凍結のやり直し: npm run loop:freeze -- 2026-07-25 --force
```

結果が揃ったあと（または fetcher が更新したあと）:

```bash
docker compose exec web npm run loop:evaluate
docker compose exec web npm run loop:report -- 2026-07-25
docker compose exec web npm run loop:trends
```

開催日どうしの突合（例: 8/8 ベースライン vs 翌日）:

```bash
docker compose exec -T web npm run loop:compare -- 2026-08-08 2026-08-09
# → src/data/loop/reports/compare-2026-08-08_2026-08-09.json
```

検証メモ（Git 管理）: [docs/VERIFY-2026-08-08.md](../../../docs/VERIFY-2026-08-08.md) · [docs/verify/analyze-2026-08-08.json](../../../docs/verify/analyze-2026-08-08.json)

閾値を変えて予測だけ作り直す（凍結オッズは触らない）:

```bash
docker compose exec web sh -c "ODDS_THRESHOLD=30 SCORE_MIN=55 npm run loop:freeze"
# オッズ上限キャップ（B3）: ODDS_MAX=80 / 解除は ODDS_MAX=none
docker compose exec web sh -c "ODDS_MAX=80 npm run loop:freeze -- 2026-08-02"
```

感度スイープ（予測ファイルは書き換えない）:

```bash
docker compose exec web npm run loop:sweep
docker compose exec web npm run loop:sweep:odds-cap
```

ゲート内機会（穴馬券内 × 製品オッズゲート）のベースライン:

```bash
npm run loop:verify-longshot-in-money
# → reports/longshot-in-money-snapshots.json（gatedOppRecall / Miss 分解）
```

定義・読み方は [HIT-RATE-PLAN.md](../../../docs/HIT-RATE-PLAN.md) §4.3。

## 3連系研究所（レーン別）

本体ループと **KPI を合算しない**。凍結オッズだけ `loop/snapshots` を共有する。

| パス | 内容 |
|------|------|
| `sanren/trio/predictions/` · `evaluations/` | 3連複研究 |
| `sanren/trifecta/predictions/` · `evaluations/` | 3連単研究 |
| `sanren/{lane}/trends/latest.json` | レーン別傾向（Git 管理） |

```bash
docker compose exec web npm run loop:sanren:freeze -- 2026-08-09
docker compose exec web npm run loop:sanren:evaluate -- 2026-08-09
docker compose exec web npm run loop:sanren:report -- 2026-08-08 2026-08-09
docker compose exec web npm run loop:sanren:trends
# 片レーンのみ: -- --lane=trio
# S5 感度（1レーン・1パラメータ）:
docker compose exec web npm run loop:sanren:sweep -- --lane=trio --param=oddsThreshold --values=80,100,150 2026-08-08 2026-08-09
```

主指標は各レーンの `ticketPrecision`。比較 JSON は並記のみ（合算フィールドなし）。詳細は [TRIFECTA-LAB.md](../../../docs/TRIFECTA-LAB.md) S4 / S5。

## 注意

- **freeze は結果が出る前に一度実行する。** 既存の `loop/snapshots` は原則上書きしない（`--force` のみ差し替え可）。
- 発売前に凍らせて placeholder（単勝 99.9）だらけなら、再 `fetch` のあと `freeze --force`。
- ライブの `src/data/snapshots/` は fetcher が結果で更新してよい。検証のオッズは常に `loop/snapshots` を使う。
- factors が合成のあいだ、指標は「製品の挙動」評価である。
