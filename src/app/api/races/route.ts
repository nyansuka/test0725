import { NextResponse } from "next/server";
import { loadRaceCatalog } from "@/data/loadCatalog";

/**
 * GET は Next.js 15+ でデフォルト非キャッシュ。明示的に動的にして
 * ローカルの fetch:jra 直後も latest.json を再読込する。
 * 本番は Cache-Control の s-maxage で CDN に乗せる（ISR は使わない）。
 * ブラウザは max-age=0 で再検証。CDN は約1時間（スナップ更新後に前日分が残らない長さ）。
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const catalog = await loadRaceCatalog();
  const isProd = process.env.NODE_ENV === "production";
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": isProd
        ? "public, max-age=0, s-maxage=3600, stale-while-revalidate=60"
        : "no-store",
    },
  });
}
