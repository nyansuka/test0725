# 定期サイトチェック（エージェント用）

間隔の目安: **30分**

```powershell
# ホストで（Docker web が起動している前提）
docker compose exec -T web npm run site:check
# PASS かつ変更ありなら commit & push（Git 作者は既存コミットに合わせる）
docker compose exec -T web npm run site:check
# push はホストの git で行う場合:
#   node が無いホストでは site-check を docker、commit/push をホスト git で分ける
```

エージェントに任せる場合のプロンプト例:

> `site-check` を実行し、PASS なら変更があれば前回作者で commit & push。FAIL なら修正して再チェック。

停止: ループ端末を止めるか「サイトチェックの定期実行を止めて」と指示。
