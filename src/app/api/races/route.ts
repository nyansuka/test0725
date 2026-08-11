import { NextResponse } from "next/server";
import { loadRaceCatalog } from "@/data/loadCatalog";

/**
 * スナップはデプロイで更新するためビルド時に静的化。
 * ISR revalidate を使わず、CDN から Fast Data Transfer で配る（Origin / ISR 抑制）。
 */
export const dynamic = "force-static";

export async function GET() {
  const catalog = await loadRaceCatalog();
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
