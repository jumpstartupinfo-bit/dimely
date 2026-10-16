import { Database } from 'bun:sqlite'
import path from 'path'
import fs from 'fs'

const DB_DIR = path.join(process.cwd(), '.data')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

const db = new Database(path.join(DB_DIR, 'dimely.db'), { create: true })

// Enable WAL mode for better concurrent read performance
db.run('PRAGMA journal_mode = WAL')
db.run('PRAGMA foreign_keys = ON')
db.run('PRAGMA busy_timeout = 5000')

// ─── Schema ────────────────────────────────────────────────────────────────

db.run(`
  CREATE TABLE IF NOT EXISTS platform_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    email_verified INTEGER NOT NULL DEFAULT 0,
    invite_code_used TEXT,
    referred_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`)

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)`)

db.run(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    headline TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    location TEXT DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    category TEXT DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    price_per_min REAL NOT NULL DEFAULT 5,
    min_duration INTEGER NOT NULL DEFAULT 15,
    max_duration INTEGER NOT NULL DEFAULT 60,
    voice_available INTEGER NOT NULL DEFAULT 1,
    video_available INTEGER NOT NULL DEFAULT 1,
    avatar_color TEXT NOT NULL DEFAULT '#6366F1',
    avatar_initials TEXT NOT NULL DEFAULT '??',
    social_instagram TEXT,
    social_twitter TEXT,
    social_linkedin TEXT,
    social_tiktok TEXT,
    social_youtube TEXT,
    verified INTEGER NOT NULL DEFAULT 0,
    published INTEGER NOT NULL DEFAULT 0,
    booking_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_profiles_category ON profiles(category)`)

db.run(`
  CREATE TABLE IF NOT EXISTS availability (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    buffer_before INTEGER NOT NULL DEFAULT 0,
    buffer_after INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_avail_profile ON availability(profile_id)`)

db.run(`
  CREATE TABLE IF NOT EXISTS availability_exceptions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    guest_user_id TEXT NOT NULL,
    host_profile_id TEXT NOT NULL,
    host_user_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration INTEGER NOT NULL,
    call_type TEXT NOT NULL,
    topic TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    guest_email TEXT NOT NULL,
    guest_timezone TEXT NOT NULL DEFAULT 'UTC',
    host_timezone TEXT NOT NULL DEFAULT 'UTC',
    status TEXT NOT NULL DEFAULT 'pending',
    gross_amount REAL NOT NULL,
    platform_fee REAL NOT NULL,
    host_earnings REAL NOT NULL,
    idempotency_key TEXT UNIQUE,
    payment_id TEXT,
    escrow_id TEXT,
    join_url TEXT,
    cancelled_by TEXT,
    cancel_reason TEXT,
    cancelled_at TEXT,
    completed_at TEXT,
    dispute_reason TEXT,
    disputed_at TEXT,
    refunded_at TEXT,
    refund_amount REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_user_id, date, status)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_user_id, status)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_bookings_idempotency ON bookings(idempotency_key)`)

db.run(`
  CREATE TABLE IF NOT EXISTS slot_reservations (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    session_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_slot_res ON slot_reservations(profile_id, date, start_time)`)

db.run(`
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    payer_user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USDC',
    status TEXT NOT NULL DEFAULT 'pending',
    tx_hash TEXT,
    confirmed_amount REAL,
    block_number TEXT,
    expires_at TEXT,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
// Migrations: add columns to payments if they don't exist (safe on existing DBs)
try { db.run(`ALTER TABLE payments ADD COLUMN confirmed_amount REAL`) } catch { /* already exists */ }
try { db.run(`ALTER TABLE payments ADD COLUMN block_number TEXT`) } catch { /* already exists */ }
try { db.run(`ALTER TABLE payments ADD COLUMN expires_at TEXT`) } catch { /* already exists */ }
try { db.run(`ALTER TABLE payments ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))`) } catch { /* already exists */ }

db.run(`
  CREATE TABLE IF NOT EXISTS escrow (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL,
    held_amount REAL NOT NULL,
    platform_fee REAL NOT NULL,
    host_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'held',
    released_at TEXT,
    refunded_at TEXT,
    disputed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    booking_id TEXT,
    reference_id TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id, created_at)`)

db.run(`
  CREATE TABLE IF NOT EXISTS wallets (
    user_id TEXT PRIMARY KEY,
    available REAL NOT NULL DEFAULT 0,
    held REAL NOT NULL DEFAULT 0,
    total_earned REAL NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    destination_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    idempotency_key TEXT UNIQUE NOT NULL,
    tx_hash TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read, created_at)`)

db.run(`
  CREATE TABLE IF NOT EXISTS disputes (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    raised_by TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    resolved_by TEXT,
    resolution_note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS cancellations (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    cancelled_by TEXT NOT NULL,
    reason TEXT,
    refund_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS calls (
    id TEXT PRIMARY KEY,
    booking_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    host_joined_at TEXT,
    guest_joined_at TEXT,
    started_at TEXT,
    ended_at TEXT,
    duration_actual INTEGER,
    server_time_offset INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS referral_codes (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    link_slug TEXT UNIQUE NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_ref_code ON referral_codes(code)`)
db.run(`CREATE INDEX IF NOT EXISTS idx_ref_slug ON referral_codes(link_slug)`)

db.run(`
  CREATE TABLE IF NOT EXISTS referral_relationships (
    id TEXT PRIMARY KEY,
    referrer_id TEXT NOT NULL,
    referred_id TEXT UNIQUE NOT NULL,
    referral_code_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    activated_at TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_refrel_referrer ON referral_relationships(referrer_id)`)

db.run(`
  CREATE TABLE IF NOT EXISTS referral_commissions (
    id TEXT PRIMARY KEY,
    referral_relationship_id TEXT NOT NULL,
    referrer_id TEXT NOT NULL,
    booking_id TEXT NOT NULL,
    platform_revenue REAL NOT NULL,
    commission_rate REAL NOT NULL,
    commission_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    eligible_at TEXT,
    paid_at TEXT,
    reversal_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_refcom_referrer ON referral_commissions(referrer_id, status)`)

db.run(`
  CREATE TABLE IF NOT EXISTS ai_agents (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    is_enabled INTEGER NOT NULL DEFAULT 0,
    auto_confirm INTEGER NOT NULL DEFAULT 1,
    respond_inquiries INTEGER NOT NULL DEFAULT 1,
    decline_conflicts INTEGER NOT NULL DEFAULT 1,
    allow_rescheduling INTEGER NOT NULL DEFAULT 0,
    allow_vip_requests INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS agent_knowledge (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    label TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS agent_activity (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    booking_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS partners (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    social_profile TEXT,
    audience_size TEXT,
    main_platform TEXT,
    category TEXT,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by TEXT,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by TEXT,
    used_by TEXT,
    used_at TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    use_count INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)
db.run(`CREATE INDEX IF NOT EXISTS idx_invite_code ON invite_codes(code)`)

// ─── Seed default config ─────────────────────────────────────────────────────
const defaults: [string, string][] = [
  ['platform_fee_percent', '20'],
  ['referral_commission_percent', '20'],
  ['referral_duration_months', '12'],
  ['invite_only', 'true'],
]

const upsertConfig = db.prepare(`INSERT OR IGNORE INTO platform_config(key, value) VALUES (?, ?)`)
for (const [k, v] of defaults) upsertConfig.run(k, v)

// ─── Compat shim: expose prepare() that mirrors better-sqlite3 API ──────────
// Bun's db.query() is similar but uses .get()/all()/run() with params as array.
// We wrap it so existing route code can use db.prepare(sql).get(...params).

type PreparedCompat = {
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
  run: (...params: unknown[]) => void
}

function prepare(sql: string): PreparedCompat {
  const stmt = db.query(sql)
  return {
    get: (...params: unknown[]) => stmt.get(...params),
    all: (...params: unknown[]) => stmt.all(...params),
    run: (...params: unknown[]) => { stmt.run(...params) },
  }
}

// Attach transaction helper
function transaction<T>(fn: () => T): () => T {
  return db.transaction(fn)
}

export { prepare, transaction }

const dbCompat = {
  ...db,
  prepare,
  transaction,
  run: (sql: string, params?: unknown[]) => db.run(sql, ...(params ?? [])),
  query: db.query.bind(db),
}

export default dbCompat

export type Row = Record<string, unknown>
