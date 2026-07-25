const http = require("http");

function get(path) {
  return new Promise((resolve) => {
    http
      .get({ host: "127.0.0.1", port: 3000, path }, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", (e) => resolve({ status: 0, body: String(e) }));
  });
}

(async () => {
  for (const p of ["/", "/longshots", "/races", "/races/chukyo-20260725-7", "/api/races"]) {
    const { status, body } = await get(p);
    if (p === "/api/races") {
      const j = JSON.parse(body);
      const live = j.races.filter((r) => r.raceDate === j.raceDate);
      console.log(
        "api",
        status,
        j.raceDate,
        "races",
        live.length,
        "results",
        live.filter((r) => r.result).length,
      );
      const r = live.find((x) => x.raceNumber === 7 && x.venue === "中京");
      console.log("chukyo7", r?.title, r?.result?.finishes?.find((f) => f.rank === 1)?.name);
    } else {
      const ok = status === 200 && body.includes("UMANOTE");
      const hasResult = body.includes("レース結果") || body.includes("結果済") || body.includes("的中");
      console.log(p, status, ok ? "OK" : "FAIL", hasResult ? "has-result-ui" : "");
    }
  }
})();
