/**
 * COMMON GROUND — Database Migration Runner
 * Reads and executes SQL migrations from `server/db/migrations/`.
 */

const fs = require("fs");
const path = require("path");
const db = require("./index");

async function runMigrations() {
  const migrationPath = path.join(__dirname, "migrations", "001_initial_schema.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  await db.exec(sql);
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("[db:migrate] PostgreSQL schema migration 001_initial_schema.sql completed.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[db:migrate] Migration failed:", err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
