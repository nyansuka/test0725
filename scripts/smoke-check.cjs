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
  const paths = ["/", "/longshots", "/races", "/settings", "/journal", "/method"];
  for (const p of paths) {
    const { status, body } = await get(p);
    const ok = status === 200 && body.includes("UMANOTE");
    console.log(`${p} ${status} ${ok ? "OK" : "FAIL"}`);
  }

  const races = await get("/races");
  const m = races.body.match(/\/races\/[a-z0-9-]+/);
  if (!m) {
    console.log("race detail link: MISSING");
    process.exit(1);
  }
  const detail = await get(m[0]);
  const hasPop = detail.body.includes("番人気");
  console.log(`${m[0]} ${detail.status} ${detail.status === 200 ? "OK" : "FAIL"} pop=${hasPop}`);

  const long = await get("/longshots");
  console.log(
    `longshots popularity marks: ${(long.body.match(/番人気/g) || []).length}`,
  );
})();
