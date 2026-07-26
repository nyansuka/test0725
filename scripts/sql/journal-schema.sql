-- UMANOTE journal schema (Neon / PostgreSQL)

CREATE TABLE IF NOT EXISTS tipsters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  channel_or_media TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
);

CREATE INDEX IF NOT EXISTS bet_slips_created_at_idx ON bet_slips (created_at DESC);
CREATE INDEX IF NOT EXISTS bet_slips_source_idx ON bet_slips (source);
CREATE INDEX IF NOT EXISTS bet_slips_race_id_idx ON bet_slips (race_id);
