/**
 * Apply journal schema to Neon.
 * Usage: node scripts/journal-migrate.mjs
 * Requires DATABASE_URL in env or .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is missing (.env.local)");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS tipsters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    channel_or_media TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS bet_slips (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('self', 'tipster')),
    race_id TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    selection TEXT NOT NULL,
    stake_yen INTEGER NOT NULL CHECK (stake_yen >= 0),
    odds_at_purchase DOUBLE PRECISION,
    payout_yen INTEGER,
    hit BOOLEAN,
    tipster_id TEXT REFERENCES tipsters (id) ON DELETE SET NULL,
    tipster_kind TEXT CHECK (
      tipster_kind IS NULL OR tipster_kind IN ('purchased', 'prediction_only')
    ),
    reference_url TEXT,
    referenced_tipster_ids JSONB,
    longshot_pick_key TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ
  )
`;

await sql`CREATE INDEX IF NOT EXISTS bet_slips_created_at_idx ON bet_slips (created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS bet_slips_source_idx ON bet_slips (source)`;
await sql`CREATE INDEX IF NOT EXISTS bet_slips_race_id_idx ON bet_slips (race_id)`;

console.log("journal schema applied.");
