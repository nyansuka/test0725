import { NextResponse } from "next/server";
import { loadRaceCatalog } from "@/data/loadCatalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const catalog = await loadRaceCatalog();
  return NextResponse.json(catalog);
}
