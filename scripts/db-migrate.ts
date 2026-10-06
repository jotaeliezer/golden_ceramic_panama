import "dotenv/config";
import { readFileSync } from "fs";
import { resolve } from "path";
import { closeDatabase, sql } from "../src/db.js";

const file = resolve("db/migrations/001_init.sql");
await sql.unsafe(readFileSync(file, "utf8"));
console.log("Applied db/migrations/001_init.sql");
await closeDatabase();
