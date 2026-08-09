import { NextResponse } from "next/server";
import { loadTipsterRaceRef } from "@/data/loadTipsterRefs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const raceId = new URL(request.url).searchParams.get("raceId");
    if (!raceId) {
      return NextResponse.json({ error: "raceId required" }, { status: 400 });
    }
    const view = await loadTipsterRaceRef(raceId);
    if (!view) {
      return NextResponse.json({ found: false, tipster: null });
    }
    return NextResponse.json({
      found: true,
      tipster: {
        tipsterId: view.tipsterId,
        tipsterName: view.tipsterName,
        raceDate: view.raceDate,
        note: view.note,
        referenceUrl: view.referenceUrl,
        race: view.race,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ found: false, tipster: null, error: message }, { status: 500 });
  }
}
