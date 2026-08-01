import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import {
  insertSlip,
  insertTipster,
  listSlips,
  listTipsters,
  upsertManySlips,
  upsertManyTipsters,
} from "@/lib/journal-db";
import type { BetSlip, Tipster } from "@/domain/types";

export const runtime = "nodejs";

export async function GET() {
  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }
  try {
    const [slips, tipsters] = await Promise.all([listSlips(), listTipsters()]);
    return NextResponse.json({ slips, tipsters, storage: "neon" });
  } catch (err) {
    console.error("[journal GET]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to load journal" },
      { status: 500 },
    );
  }
}

type PostBody =
  | { action: "addSlip"; slip: BetSlip }
  | { action: "addSlips"; slips: BetSlip[] }
  | { action: "addTipster"; tipster: Tipster }
  | { action: "migrate"; slips: BetSlip[]; tipsters: Tipster[] };

export async function POST(req: Request) {
  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }
  try {
    const body = (await req.json()) as PostBody;
    if (body.action === "addSlip") {
      const slip = await insertSlip(body.slip);
      return NextResponse.json({ slip });
    }
    if (body.action === "addSlips") {
      const slips = body.slips ?? [];
      const n = await upsertManySlips(slips);
      return NextResponse.json({ count: n, slips });
    }
    if (body.action === "addTipster") {
      const tipster = await insertTipster(body.tipster);
      return NextResponse.json({ tipster });
    }
    if (body.action === "migrate") {
      const tipsters = await upsertManyTipsters(body.tipsters ?? []);
      const slips = await upsertManySlips(body.slips ?? []);
      return NextResponse.json({ migrated: { tipsters, slips } });
    }
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    console.error("[journal POST]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to write journal" },
      { status: 500 },
    );
  }
}
