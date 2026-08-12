# NAR snapshots

地方競馬（NAR）用スナップショット。JRA の `../snapshots/` とは分離する。

生成:

```bash
npm run fetch:nar:official          # 南関東（既定）
npm run fetch:nar:official:all      # 全日全場
```

ソース: [keiba.go.jp データダウンロード](https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop)（公式 CSV）。  
詳細は `docs/NAR-PLAN.md` §17。
