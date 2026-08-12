# 3連系研究所ループ（レーン別）

本体 `loop/` の全券種指標とは **分離**する。合算 KPI は持たない。

| パス | Git |
|------|-----|
| `{trio,trifecta}/predictions/` | ignore |
| `{trio,trifecta}/evaluations/` | ignore |
| `{trio,trifecta}/reports/` | ignore |
| `{trio,trifecta}/trends/latest.json` | **commit** |
| `reports/compare-lanes-*.json` | ignore |

凍結オッズは親の `../snapshots/` を共有。使い方は [README.md](../README.md) の「3連系研究所」節と [TRIFECTA-LAB.md](../../../../docs/TRIFECTA-LAB.md) S4。
