import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let cached: NeonQueryFunction<false, false> | null = null;

/** Neon SQL client（サーバー専用）。DATABASE_URL 必須。 */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!cached) cached = neon(url);
  return cached;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
