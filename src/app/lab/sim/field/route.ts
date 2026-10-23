import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * 並びは scripts/build-sim-fields.mts が馬成績キャッシュから先に作る。
 * ここで netkeiba を取りに行くと、本番の関数が時間切れになり走行が出ない。
 */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const match = id.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return Response.json({ error: "このレースの走行はありません" }, { status: 404 });
  }
  const date = `${match[1]}-${match[2]}-${match[3]}`;
  try {
    const file = JSON.parse(
      await readFile(path.join(process.cwd(), "src", "data", "sim-fields", `${date}.json`), "utf8"),
    ) as { races?: Record<string, unknown> };
    const field = file.races?.[id];
    if (!field) {
      return Response.json({ error: "このレースの走行はありません" }, { status: 404 });
    }
    return Response.json(field);
  } catch {
    return Response.json({ error: "このレースの走行はありません" }, { status: 404 });
  }
}
