/**
 * Create or replace an admin password hash.
 *
 * Upsert (needs DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD):
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='choose-a-long-password' npm run admin:set-password
 *
 * Print only the bcrypt hash, with no database connection:
 *   ADMIN_PASSWORD='choose-a-long-password' npm run admin:set-password -- --print-hash
 *
 * Do not commit the password or the hash.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";

const printHash = process.argv.includes("--print-hash");
const password = process.env.ADMIN_PASSWORD ?? "";
const email = process.env.ADMIN_EMAIL?.trim() ?? "";

if (!password) {
  console.error("Set ADMIN_PASSWORD in the environment. It is not read from the command line.");
  process.exit(1);
}

const hash = await bcrypt.hash(password, 10);

if (printHash) {
  process.stdout.write(`${hash}\n`);
  process.exit(0);
}

if (!email) {
  console.error("Set ADMIN_EMAIL in the environment.");
  process.exit(1);
}

const { closeDatabase, sql } = await import("../src/db.js");
const id = `admin_${crypto.randomUUID()}`;
await sql`
  INSERT INTO admin_users (id, email, password)
  VALUES (${id}, ${email}, ${hash})
  ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password
`;
console.log(`Saved a password hash for ${email}.`);
await closeDatabase();
