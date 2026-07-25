# UMANOTE — 競馬予想サンプルサイト

Next.js + Docker で動かす、ローカル向けの競馬予想デモサイトです。

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

## 構成

| パス | 内容 |
|------|------|
| `src/app/page.tsx` | トップ（ヒーロー / 本日の本命 / レース一覧） |
| `src/app/races/[id]/page.tsx` | レース詳細 |
| `src/data/races.ts` | サンプル予想データ |
| `Dockerfile` / `docker-compose.yml` | ローカルコンテナ環境 |

## 補足

- 表示データはすべてサンプルです。実レース結果や投票には使えません。
- ソース変更はボリュームマウントによりホットリロードされます。
