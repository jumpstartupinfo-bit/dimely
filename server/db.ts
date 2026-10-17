/**
 * Database adapter — switches between SQLite (dev) and Postgres (production).
 *
 * In production (DATABASE_URL set): uses the `pg` Pool directly with a
 * synchronous-style wrapper that works with async route handlers.
 *
 * In development (no DATABASE_URL): uses bun:sqlite.
 *
 * ALL db.prepare(sql).get/all/run() calls in route files must be awaited
 * when using Postgres. Route handlers are already async so this works.
 */

import { Pool } from 'pg'
import { Database } from 'bun:sqlite'
import path from 'path'

const IS_PG = !!process.env.DATABASE_URL

// ─── Postgres mode ────────────────────────────────────────────────────────────

let pgPool: Pool | null = null
if (IS_PG) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  pgPool.on('error', (err) => console.error('PG pool error:', err))
}

function pgQuery(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  // Convert ? placeholders to $1, $2 if any remain (legacy SQLite style)
  let i = 0
  const pgSql = sql.replace(/\?/g, () => `$${++i}`)
  return pgPool!.query(pgSql, params).then((r) => r.rows)
}

function makePgStatement(sql: string) {
  return {
    get: (...params: unknown[]) => pgQuery(sql, params).then((rows) => rows[0] ?? undefined),
    all: (...params: unknown[]) => pgQuery(sql, params),
    run: (...params: unknown[]) => pgQuery(sql, params).then(() => undefined),
  }
}

async function pgTransaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pgPool!.connect()
  try {
    await client.query('BEGIN')
    const result = await fn()
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

const pgDb = {
  prepare: (sql: string) => makePgStatement(sql),
  query:   (sql: string) => makePgStatement(sql),
  run: (sql: string, ...params: unknown[]) => pgQuery(sql, params).then(() => undefined),
  transaction: <T>(fn: () => Promise<T>) => pgTransaction(fn),
}

// ─── SQLite mode (dev) ────────────────────────────────────────────────────────

const DB_PATH = path.join(process.cwd(), 'dimely.db')
let sqliteDb: Database | null = null

if (!IS_PG) {
  sqliteDb = new Database(DB_PATH)
  sqliteDb.exec('PRAGMA journal_mode = WAL')
  sqliteDb.exec('PRAGMA foreign_keys = ON')

  // Run schema inline (abbreviated — full schema in supabase/schema.sql)
  // For dev we keep the existing SQLite DB file which already has the schema.
}

type PreparedCompat = {
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
  run: (...params: unknown[]) => void
}

function sqlitePrepare(sql: string): PreparedCompat {
  const stmt = sqliteDb!.query(sql)
  return {
    get: (...params: unknown[]) => stmt.get(...params),
    all: (...params: unknown[]) => stmt.all(...params),
    run: (...params: unknown[]) => { stmt.run(...params) },
  }
}

function sqliteTransaction<T>(fn: () => T): () => T {
  return sqliteDb!.transaction(fn)
}

const sqliteDbCompat = sqliteDb ? {
  ...sqliteDb,
  prepare: sqlitePrepare,
  transaction: sqliteTransaction,
  run: (sql: string, params?: unknown[]) => sqliteDb!.run(sql, ...(params ?? [])),
  query: sqliteDb.query.bind(sqliteDb),
} : null

// ─── Seed default config (SQLite dev only) ────────────────────────────────────

if (!IS_PG && sqliteDb) {
  // Minimal schema bootstrap for dev — tables created by db.ts previously
  // The full schema already exists in the SQLite file from previous sessions
  const defaults: [string, string][] = [
    ['platform_fee_percent', '20'],
    ['referral_percent', '20'],
    ['referral_duration_months', '12'],
    ['invite_only', 'false'],
  ]
  for (const [k, v] of defaults) {
    try {
      sqliteDb.run(`INSERT OR IGNORE INTO platform_config(key, value) VALUES (?, ?)`, k, v)
    } catch { /* table may not exist in dev */ }
  }
}

// ─── Export the right adapter ─────────────────────────────────────────────────

const db = IS_PG ? pgDb : sqliteDbCompat!
export default db
export { pgPool }
export type Row = Record<string, unknown>
