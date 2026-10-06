import { readFileSync } from "fs";
import { join } from "path";
import postgres from "postgres";

/**
 * One short-lived connection per serverless instance.
 * `prepare: false` is required for the Supabase transaction pooler (port 6543).
 * The URL comes only from DATABASE_URL.
 */
const globalForSql = globalThis as typeof globalThis & {
  __goldenCeramicSql?: postgres.Sql;
};

function createSql(): postgres.Sql {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required.");
  }

  const local = /localhost|127\.0\.0\.1/.test(databaseUrl);
  return postgres(databaseUrl, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    ssl: local ? false : "require",
    onnotice: () => {},
  });
}

export const sql = globalForSql.__goldenCeramicSql ?? createSql();
globalForSql.__goldenCeramicSql = sql;

export async function closeDatabase(): Promise<void> {
  await sql.end({ timeout: 5 });
  globalForSql.__goldenCeramicSql = undefined;
}

/**
 * Local development only. Applies db/migrations/001_init.sql and the demo
 * admin row. Never runs on Vercel, and never on a request.
 */
export async function bootstrapLocalSchema(): Promise<void> {
  if (process.env.VERCEL) return;

  const migrationPath = join(process.cwd(), "db/migrations/001_init.sql");
  await sql.unsafe(readFileSync(migrationPath, "utf8"));

  const existing = await sql`
    SELECT 1 FROM admin_users WHERE email = ${"admin@goldenceramic.com"}
  `;
  if (existing.length === 0) {
    await sql`
      INSERT INTO admin_users (id, email, password)
      VALUES ('admin-1', 'admin@goldenceramic.com', 'admin123')
    `;
  }
}

export default sql;
