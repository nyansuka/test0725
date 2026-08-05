-- TFJV / TARGET Race Results（人気・着順・タイム等）
-- 適用: npm run tfjv:migrate

CREATE TABLE IF NOT EXISTS tfjv_races (
  race_key TEXT PRIMARY KEY,
  race_date_raw CHAR(6) NOT NULL,
  race_date DATE,
  kaijou TEXT NOT NULL,
  race_no SMALLINT NOT NULL,
  race_name TEXT,
  grade TEXT,
  track TEXT,
  distance_m INTEGER,
  course_type TEXT,
  baba TEXT,
  head_count SMALLINT,
  source_file TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tfjv_entries (
  race_key TEXT NOT NULL REFERENCES tfjv_races (race_key) ON DELETE CASCADE,
  horse_number SMALLINT NOT NULL,
  horse_name TEXT,
  jockey TEXT,
  trainer TEXT,
  sex TEXT,
  age SMALLINT,
  weight_carried REAL,
  popularity SMALLINT,
  finish_rank SMALLINT,
  win_payout INTEGER,
  place_payout INTEGER,
  time_raw TEXT,
  time_sec REAL,
  margin TEXT,
  last_3f REAL,
  pci REAL,
  pci3 REAL,
  rpci REAL,
  horse_weight INTEGER,
  horse_weight_delta INTEGER,
  corner_2 SMALLINT,
  corner_3 SMALLINT,
  corner_4 SMALLINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (race_key, horse_number)
);

CREATE INDEX IF NOT EXISTS tfjv_races_date_idx ON tfjv_races (race_date);
CREATE INDEX IF NOT EXISTS tfjv_races_grade_idx ON tfjv_races (grade);
CREATE INDEX IF NOT EXISTS tfjv_entries_finish_idx ON tfjv_entries (finish_rank);
CREATE INDEX IF NOT EXISTS tfjv_entries_pop_idx ON tfjv_entries (popularity);
CREATE INDEX IF NOT EXISTS tfjv_entries_winner_pop_idx
  ON tfjv_entries (popularity)
  WHERE finish_rank = 1;
