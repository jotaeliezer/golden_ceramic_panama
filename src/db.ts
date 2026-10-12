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

export type PaidClaim = "paid" | "already_paid" | "missing";
export type CancelClaim = "canceled" | "unchanged" | "missing";

/**
 * Mark a pending order paid and lower stock once.
 * The conditional UPDATE locks the row. A replay sees a status other than
 * pending and leaves stock alone.
 */
export async function markOrderPaidAndLowerStock(orderId: string): Promise<PaidClaim> {
  return sql.begin(async (tx): Promise<PaidClaim> => {
    const claimed = await tx`
      UPDATE orders
      SET status = 'paid'
      WHERE id = ${orderId} AND status = 'pending'
      RETURNING id
    `;
    if (claimed.length === 0) {
      const existing = await tx`SELECT id FROM orders WHERE id = ${orderId}`;
      return existing.length > 0 ? "already_paid" : "missing";
    }

    const items = await tx<{ product_id: string; quantity: number }[]>`
      SELECT product_id, quantity FROM order_items WHERE order_id = ${orderId}
    `;
    for (const item of items) {
      await tx`
        UPDATE products
        SET stock = stock - ${item.quantity}
        WHERE id = ${item.product_id}
      `;
    }
    return "paid";
  });
}

/** Cancel only while the order is still pending. Paid orders stay paid. */
export async function markPendingOrderCanceled(orderId: string): Promise<CancelClaim> {
  return sql.begin(async (tx): Promise<CancelClaim> => {
    const claimed = await tx`
      UPDATE orders
      SET status = 'canceled'
      WHERE id = ${orderId} AND status = 'pending'
      RETURNING id
    `;
    if (claimed.length > 0) return "canceled";
    const existing = await tx`SELECT id FROM orders WHERE id = ${orderId}`;
    return existing.length > 0 ? "unchanged" : "missing";
  });
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
