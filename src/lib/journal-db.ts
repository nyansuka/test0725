import type { BetSlip, Tipster } from "@/domain/types";
import { getSql } from "@/lib/db";

type TipsterRow = {
  id: string;
  name: string;
  channel_or_media: string | null;
};

type SlipRow = {
  id: string;
  source: BetSlip["source"];
  race_id: string;
  bet_type: BetSlip["betType"];
  selection: string;
  stake_yen: number;
  odds_at_purchase: number | null;
  payout_yen: number | null;
  hit: boolean | null;
  tipster_id: string | null;
  tipster_kind: BetSlip["tipsterKind"] | null;
  reference_url: string | null;
  referenced_tipster_ids: string[] | null;
  longshot_pick_key: string | null;
  note: string | null;
  created_at: string;
  settled_at: string | null;
};

export function rowToTipster(row: TipsterRow): Tipster {
  return {
    id: row.id,
    name: row.name,
    channelOrMedia: row.channel_or_media ?? undefined,
  };
}

export function rowToSlip(row: SlipRow): BetSlip {
  return {
    id: row.id,
    source: row.source,
    raceId: row.race_id,
    betType: row.bet_type,
    selection: row.selection,
    stakeYen: row.stake_yen,
    oddsAtPurchase: row.odds_at_purchase ?? undefined,
    payoutYen: row.payout_yen,
    hit: row.hit ?? undefined,
    tipsterId: row.tipster_id ?? undefined,
    tipsterKind: row.tipster_kind ?? undefined,
    referenceUrl: row.reference_url ?? undefined,
    referencedTipsterIds: row.referenced_tipster_ids ?? undefined,
    longshotPickKey: row.longshot_pick_key ?? undefined,
    note: row.note ?? undefined,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    settledAt: row.settled_at
      ? typeof row.settled_at === "string"
        ? row.settled_at
        : new Date(row.settled_at).toISOString()
      : undefined,
  };
}

export async function listTipsters(): Promise<Tipster[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, channel_or_media
    FROM tipsters
    ORDER BY created_at ASC
  `;
  return (rows as TipsterRow[]).map(rowToTipster);
}

export async function listSlips(): Promise<BetSlip[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      id, source, race_id, bet_type, selection, stake_yen,
      odds_at_purchase, payout_yen, hit, tipster_id, tipster_kind,
      reference_url, referenced_tipster_ids, longshot_pick_key, note,
      created_at, settled_at
    FROM bet_slips
    ORDER BY created_at DESC
  `;
  return (rows as SlipRow[]).map(rowToSlip);
}

export async function insertTipster(tipster: Tipster): Promise<Tipster> {
  const sql = getSql();
  await sql`
    INSERT INTO tipsters (id, name, channel_or_media)
    VALUES (${tipster.id}, ${tipster.name}, ${tipster.channelOrMedia ?? null})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      channel_or_media = EXCLUDED.channel_or_media
  `;
  return tipster;
}

export async function insertSlip(slip: BetSlip): Promise<BetSlip> {
  const sql = getSql();
  await sql`
    INSERT INTO bet_slips (
      id, source, race_id, bet_type, selection, stake_yen,
      odds_at_purchase, payout_yen, hit, tipster_id, tipster_kind,
      reference_url, referenced_tipster_ids, longshot_pick_key, note,
      created_at, settled_at
    ) VALUES (
      ${slip.id},
      ${slip.source},
      ${slip.raceId},
      ${slip.betType},
      ${slip.selection},
      ${slip.stakeYen},
      ${slip.oddsAtPurchase ?? null},
      ${slip.payoutYen},
      ${slip.hit ?? null},
      ${slip.tipsterId ?? null},
      ${slip.tipsterKind ?? null},
      ${slip.referenceUrl ?? null},
      ${slip.referencedTipsterIds ?? null},
      ${slip.longshotPickKey ?? null},
      ${slip.note ?? null},
      ${slip.createdAt},
      ${slip.settledAt ?? null}
    )
    ON CONFLICT (id) DO NOTHING
  `;
  return slip;
}

export async function updateSlip(
  id: string,
  patch: Partial<BetSlip>,
): Promise<BetSlip | null> {
  const sql = getSql();
  const existing = await sql`
    SELECT
      id, source, race_id, bet_type, selection, stake_yen,
      odds_at_purchase, payout_yen, hit, tipster_id, tipster_kind,
      reference_url, referenced_tipster_ids, longshot_pick_key, note,
      created_at, settled_at
    FROM bet_slips
    WHERE id = ${id}
    LIMIT 1
  `;
  if (existing.length === 0) return null;
  const current = rowToSlip(existing[0] as SlipRow);
  const next: BetSlip = { ...current, ...patch };
  if (patch.payoutYen !== undefined) {
    next.hit = patch.payoutYen != null ? patch.payoutYen > 0 : undefined;
    if (patch.payoutYen != null && !patch.settledAt) {
      next.settledAt = new Date().toISOString();
    }
  }

  await sql`
    UPDATE bet_slips SET
      source = ${next.source},
      race_id = ${next.raceId},
      bet_type = ${next.betType},
      selection = ${next.selection},
      stake_yen = ${next.stakeYen},
      odds_at_purchase = ${next.oddsAtPurchase ?? null},
      payout_yen = ${next.payoutYen},
      hit = ${next.hit ?? null},
      tipster_id = ${next.tipsterId ?? null},
      tipster_kind = ${next.tipsterKind ?? null},
      reference_url = ${next.referenceUrl ?? null},
      referenced_tipster_ids = ${next.referencedTipsterIds ?? null},
      longshot_pick_key = ${next.longshotPickKey ?? null},
      note = ${next.note ?? null},
      settled_at = ${next.settledAt ?? null}
    WHERE id = ${id}
  `;
  return next;
}

export async function deleteSlip(id: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM bet_slips WHERE id = ${id} RETURNING id
  `;
  return rows.length > 0;
}

export async function upsertManyTipsters(tipsters: Tipster[]): Promise<number> {
  let n = 0;
  for (const t of tipsters) {
    await insertTipster(t);
    n += 1;
  }
  return n;
}

export async function upsertManySlips(slips: BetSlip[]): Promise<number> {
  let n = 0;
  for (const s of slips) {
    await insertSlip(s);
    n += 1;
  }
  return n;
}
