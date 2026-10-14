import "dotenv/config";
import { closeDatabase, applySchemaMigrations } from "../src/db.js";

const files = await applySchemaMigrations();
for (const name of files) {
  console.log(`Applied db/migrations/${name}`);
}
await closeDatabase();
