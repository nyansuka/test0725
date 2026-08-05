/**
 * Apply TFJV schema to Neon.
 *   node scripts/tfjv-migrate.mjs
 * Requires DATABASE_URL in env or .env.local
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

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

const schemaPath = resolve(process.cwd(), "scripts/sql/tfjv-schema.sql");
const ddl = readFileSync(schemaPath, "utf8");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(ddl);

const races = await client.query("SELECT COUNT(*)::int AS n FROM tfjv_races");
const entries = await client.query("SELECT COUNT(*)::int AS n FROM tfjv_entries");
await client.end();

console.log("tfjv schema applied.", {
  races: races.rows[0].n,
  entries: entries.rows[0].n,
});
