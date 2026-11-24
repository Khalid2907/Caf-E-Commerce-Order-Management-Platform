/**
 * COMMON GROUND — PostgreSQL Database Connection & Transaction Manager
 *
 * Dual-driver PostgreSQL engine:
 * 1. If `process.env.DATABASE_URL` is configured (and not set to 'pglite'), connects to
 *    an external/managed PostgreSQL instance using `pg` (`node-postgres` Pool).
 * 2. Otherwise, boots an embedded PostgreSQL 16 instance via `@electric-sql/pglite`
 *    persisted in `process.env.PGLITE_DATA_DIR || './.pgdata'` (or `memory://` in test mode).
 *
 * Provides a unified `query(sql, params)`, `exec(sql)`, and `withTransaction(fn)` API.
 */

const path = require("path");
const { Pool } = require("pg");
const { PGlite } = require("@electric-sql/pglite");

let pgPool = null;
let pgliteInstance = null;
let initialized = false;

function shouldUseExternalPostgres() {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
      url.startsWith("postgres") &&
      !url.includes("CHANGE_ME_PASSWORD") &&
      process.env.USE_PGLITE !== "true"
  );
}

async function getDbEngine() {
  if (shouldUseExternalPostgres()) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.NODE_ENV === "production" &&
          !process.env.DATABASE_URL.includes("localhost")
            ? { rejectUnauthorized: false }
            : false,
      });
    }
    return { type: "pg", client: pgPool };
  }

  if (!pgliteInstance) {
    const dataDir =
      process.env.NODE_ENV === "test"
        ? "memory://"
        : path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || ".pgdata");
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
  }
  return { type: "pglite", client: pgliteInstance };
}

/**
 * Executes a parameterized SQL query ($1, $2, ...).
 * @param {string} text
 * @param {Array<any>} [params=[]]
 */
async function query(text, params = []) {
  const engine = await getDbEngine();
  return engine.client.query(text, params);
}

/**
 * Executes a multi-statement SQL script (used for migrations).
 * @param {string} sqlScript
 */
async function exec(sqlScript) {
  const engine = await getDbEngine();
  if (engine.type === "pglite") {
    return engine.client.exec(sqlScript);
  }
  return engine.client.query(sqlScript);
}

/**
 * Runs an async callback inside a PostgreSQL `BEGIN ... COMMIT / ROLLBACK` transaction.
 * @template T
 * @param {(tx: { query: (sql: string, params?: any[]) => Promise<any> }) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withTransaction(callback) {
  const engine = await getDbEngine();

  if (engine.type === "pglite") {
    return engine.client.transaction(async (tx) => {
      return callback({
        query: (sql, params = []) => tx.query(sql, params),
      });
    });
  }

  const client = await engine.client.connect();
  try {
    await client.query("BEGIN");
    const result = await callback({
      query: (sql, params = []) => client.query(sql, params),
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function closeDb() {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (pgliteInstance) {
    await pgliteInstance.close();
    pgliteInstance = null;
  }
  initialized = false;
}

module.exports = {
  query,
  exec,
  withTransaction,
  getDbEngine,
  closeDb,
  isInitialized: () => initialized,
  setInitialized: (val) => {
    initialized = val;
  },
};
