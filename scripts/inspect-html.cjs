const fs = require("fs");
const html = fs.readFileSync("/tmp/r.html", "utf8");
const keys = [
  "開催日",
  'type="date"',
  "サンプル開催",
  "本日に戻す",
  "tablist",
  "レース一覧",
  "本日",
  "input",
];
for (const s of keys) {
  console.log(JSON.stringify(s), html.split(s).length - 1);
}
const i = html.indexOf("レース一覧");
console.log("---snippet---");
console.log(html.slice(i, i + 1500));
