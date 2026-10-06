import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { closeDatabase, sql } from "../src/db.js";

const file = resolve("db/seed/001_sample_products.sql");
await sql.unsafe(readFileSync(file, "utf8"));
const [{ count }] = await sql`SELECT count(*)::int AS count FROM products`;
console.log(`Applied db/seed/001_sample_products.sql (${count} products in the table).`);
await closeDatabase();
