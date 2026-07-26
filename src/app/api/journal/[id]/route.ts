import { NextResponse } from "next/server";
import { dbConfigured } from "@/lib/db";
import { deleteSlip, updateSlip } from "@/lib/journal-db";
import type { BetSlip } from "@/domain/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  try {
    const patch = (await req.json()) as Partial<BetSlip>;
    const slip = await updateSlip(id, patch);
    if (!slip) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ slip });
  } catch (err) {
    console.error("[journal PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to update" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  if (!dbConfigured()) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured" },
      { status: 503 },
    );
  }
  const { id } = await ctx.params;
  try {
    const ok = await deleteSlip(id);
    if (!ok) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[journal DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed to delete" },
      { status: 500 },
    );
  }
}
