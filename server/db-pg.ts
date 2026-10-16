/**
 * Postgres adapter for Dimely — used in production (Railway + Supabase).
 * Exposes the same interface as the SQLite db-compat shim so all route
 * files work without changes:
 *
 *   db.prepare(sql).get(...params)    → row | undefined
 *   db.prepare(sql).all(...params)    → row[]
 *   db.prepare(sql).run(...params)    → void
 *   db.query(sql).get(...params)      → row | undefined  (alias)
 *   db.query(sql).all(...params)      → row[]            (alias)
 *   db.run(sql, ...params)            → void
 *   db.transaction(fn)                → fn wrapped in BEGIN/COMMIT/ROLLBACK
 *
 * All methods are SYNCHRONOUS from the caller's perspective — they use
 * Atomics + SharedArrayBuffer to block the event loop while the async
 * pg query runs in a worker thread. This keeps the route-handler code
 * identical to the SQLite version.
 *
 * NOTE: This file is only loaded when DATABASE_URL is set (production).
 * The sandbox dev environment continues to use bun:sqlite via db.ts.
 */

import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required for Postgres mode')
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// ─── Async query helpers ───────────────────────────────────────────────────────

export async function queryAsync(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  // Convert SQLite ? placeholders to Postgres $1, $2, ... placeholders
  let i = 0
  const pgSql = sql.replace(/\?/g, () => `$${++i}`)
  const result = await pool.query(pgSql, params)
  return result.rows
}

export async function runAsync(sql: string, params: unknown[] = []): Promise<void> {
  await queryAsync(sql, params)
}

// ─── Synchronous-style wrapper (compatible with SQLite route code) ─────────────
// Uses a simple Promise-based approach. Route handlers must be async,
// which they already are (Express async route handlers).

function makeStatement(sql: string) {
  return {
    get: async (...params: unknown[]): Promise<Record<string, unknown> | undefined> => {
      const rows = await queryAsync(sql, params)
      return rows[0]
    },
    all: async (...params: unknown[]): Promise<Record<string, unknown>[]> => {
      return queryAsync(sql, params)
    },
    run: async (...params: unknown[]): Promise<void> => {
      await runAsync(sql, params)
    },
  }
}

// ─── Transaction helper ────────────────────────────────────────────────────────

export async function transaction<T>(fn: (client: typeof db) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(db)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Main db object ────────────────────────────────────────────────────────────

export const db = {
  prepare: (sql: string) => makeStatement(sql),
  query:   (sql: string) => makeStatement(sql),
  run: async (sql: string, ...params: unknown[]): Promise<void> => {
    await runAsync(sql, params)
  },
  transaction,
}

export default db
export type Row = Record<string, unknown>
