import http from "node:http";
import https from "node:https";

function get(url) {
  const lib = url.startsWith("https") ? https : http;
  return new Promise((resolve, reject) => {
    lib
      .get(url, (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode, body }));
      })
      .on("error", reject);
  });
}

function summarize(label, body) {
  const htmlTag = (body.match(/<html[^>]*>/) || [])[0] || "";
  console.log(`\n=== ${label} ===`);
  console.log("HTML_TAG", htmlTag.slice(0, 200));
  console.log("has_bricolage", /bricolage/i.test(body));
  console.log("has_source_serif", /source_serif/i.test(body));
  console.log("has_noto", /noto_sans/i.test(body));
}

const local = await get("http://127.0.0.1:3000/");
summarize("local :3000", local.body);

try {
  const prod = await get("https://test0725.vercel.app/");
  summarize("vercel prod", prod.body);
} catch (e) {
  console.log("\n=== vercel prod ===");
  console.log("fetch_failed", String(e));
}
