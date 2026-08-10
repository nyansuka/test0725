import { NextResponse } from "next/server";
import { loadRaceCatalog } from "@/data/loadCatalog";

/** スナップはデプロイで更新。CDN に載せて Fast Origin Transfer を抑える */
export const revalidate = 3600;

export async function GET() {
  const catalog = await loadRaceCatalog();
  return NextResponse.json(catalog, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
