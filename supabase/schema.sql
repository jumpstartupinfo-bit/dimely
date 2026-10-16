-- Dimely — Supabase/Postgres schema
-- Run this in the Supabase SQL editor to create all tables.
-- https://supabase.com → SQL Editor → New query → paste → Run

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id               TEXT PRIMARY KEY,
  email            TEXT NOT NULL UNIQUE,
  password_hash    TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  username         TEXT NOT NULL UNIQUE,
  role             TEXT NOT NULL DEFAULT 'user',
  verified         BOOLEAN NOT NULL DEFAULT FALSE,
  suspended        BOOLEAN NOT NULL DEFAULT FALSE,
  referred_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ─── Sessions ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  username         TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL DEFAULT '',
  headline         TEXT NOT NULL DEFAULT '',
  bio              TEXT NOT NULL DEFAULT '',
  location         TEXT NOT NULL DEFAULT '',
  company          TEXT NOT NULL DEFAULT '',
  website          TEXT NOT NULL DEFAULT '',
  twitter          TEXT NOT NULL DEFAULT '',
  linkedin         TEXT NOT NULL DEFAULT '',
  instagram        TEXT NOT NULL DEFAULT '',
  youtube          TEXT NOT NULL DEFAULT '',
  categories       TEXT NOT NULL DEFAULT '[]',
  skills           TEXT NOT NULL DEFAULT '[]',
  interests        TEXT NOT NULL DEFAULT '[]',
  avatar_url       TEXT NOT NULL DEFAULT '',
  avatar_color     TEXT NOT NULL DEFAULT '#6366F1',
  avatar_initials  TEXT NOT NULL DEFAULT '',
  price_per_min    NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  min_duration     INTEGER NOT NULL DEFAULT 15,
  max_duration     INTEGER NOT NULL DEFAULT 60,
  video_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  voice_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  timezone         TEXT NOT NULL DEFAULT 'UTC',
  published        BOOLEAN NOT NULL DEFAULT TRUE,
  verified         BOOLEAN NOT NULL DEFAULT FALSE,
  completed_calls  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_published ON profiles(published);

-- ─── Availability ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id           TEXT PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  day_of_week  INTEGER NOT NULL, -- 0=Sun, 6=Sat
  start_time   TEXT NOT NULL,    -- "HH:MM"
  end_time     TEXT NOT NULL,    -- "HH:MM"
  buffer_mins  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_availability_profile ON availability(profile_id);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,
  host_id          TEXT NOT NULL REFERENCES users(id),
  guest_id         TEXT NOT NULL REFERENCES users(id),
  profile_id       TEXT NOT NULL REFERENCES profiles(id),
  date             TEXT NOT NULL,   -- "YYYY-MM-DD"
  start_time       TEXT NOT NULL,   -- "HH:MM"
  duration_mins    INTEGER NOT NULL,
  call_type        TEXT NOT NULL DEFAULT 'video',
  topic            TEXT NOT NULL DEFAULT '',
  guest_name       TEXT NOT NULL DEFAULT '',
  guest_email      TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'pending',
  booking_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  platform_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  host_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  idempotency_key  TEXT NOT NULL UNIQUE,
  call_started_at  TIMESTAMPTZ,
  call_ended_at    TIMESTAMPTZ,
  cancelled_at     TIMESTAMPTZ,
  cancel_reason    TEXT NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bookings_host ON bookings(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_guest ON bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

-- ─── Slot Reservations ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slot_reservations (
  id           TEXT PRIMARY KEY,
  profile_id   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  start_time   TEXT NOT NULL,
  duration     INTEGER NOT NULL,
  booking_id   TEXT REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Payments ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  booking_id          TEXT NOT NULL REFERENCES bookings(id),
  customer_id         TEXT NOT NULL REFERENCES users(id),
  host_id             TEXT NOT NULL REFERENCES users(id),
  amount              NUMERIC(10,2) NOT NULL,
  platform_fee        NUMERIC(10,2) NOT NULL,
  host_amount         NUMERIC(10,2) NOT NULL,
  currency            TEXT NOT NULL DEFAULT 'USDC',
  network             TEXT NOT NULL DEFAULT 'arc-testnet',
  usdc_contract       TEXT NOT NULL DEFAULT '',
  recipient_address   TEXT NOT NULL DEFAULT '',
  sender_address      TEXT NOT NULL DEFAULT '',
  tx_hash             TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'created',
  idempotency_key     TEXT NOT NULL UNIQUE,
  expires_at          TIMESTAMPTZ,
  confirmed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ─── Escrow ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow (
  id           TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payments(id),
  booking_id   TEXT NOT NULL REFERENCES bookings(id),
  amount       NUMERIC(10,2) NOT NULL,
  currency     TEXT NOT NULL DEFAULT 'USDC',
  status       TEXT NOT NULL DEFAULT 'held',
  released_at  TIMESTAMPTZ,
  refunded_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Wallets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available      NUMERIC(10,2) NOT NULL DEFAULT 0,
  held           NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_earned   NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency       TEXT NOT NULL DEFAULT 'USDC',
  wallet_address TEXT NOT NULL DEFAULT '',
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Transactions (ledger) ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  booking_id  TEXT REFERENCES bookings(id),
  payment_id  TEXT REFERENCES payments(id),
  type        TEXT NOT NULL,
  amount      NUMERIC(10,2) NOT NULL,
  currency    TEXT NOT NULL DEFAULT 'USDC',
  status      TEXT NOT NULL DEFAULT 'completed',
  reference   TEXT NOT NULL DEFAULT '',
  tx_hash     TEXT NOT NULL DEFAULT '',
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_booking ON transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

-- ─── Withdrawals ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id),
  amount           NUMERIC(10,2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'USDC',
  wallet_address   TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'requested',
  tx_hash          TEXT NOT NULL DEFAULT '',
  idempotency_key  TEXT NOT NULL UNIQUE,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  data        TEXT NOT NULL DEFAULT '{}',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- ─── Disputes ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disputes (
  id           TEXT PRIMARY KEY,
  booking_id   TEXT NOT NULL REFERENCES bookings(id),
  opened_by    TEXT NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  evidence     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'open',
  resolved_by  TEXT REFERENCES users(id),
  resolved_at  TIMESTAMPTZ,
  resolution   TEXT NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Referral Codes ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_codes (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code       TEXT NOT NULL UNIQUE,
  link_slug  TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Referral Relationships ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_relationships (
  id            TEXT PRIMARY KEY,
  referrer_id   TEXT NOT NULL REFERENCES users(id),
  referred_id   TEXT NOT NULL UNIQUE REFERENCES users(id),
  code          TEXT NOT NULL,
  activated_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referral_relationships(referrer_id);

-- ─── Referral Commissions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_commissions (
  id             TEXT PRIMARY KEY,
  referrer_id    TEXT NOT NULL REFERENCES users(id),
  referred_id    TEXT NOT NULL REFERENCES users(id),
  booking_id     TEXT NOT NULL REFERENCES bookings(id),
  payment_id     TEXT NOT NULL REFERENCES payments(id),
  gross_amount   NUMERIC(10,2) NOT NULL,
  platform_fee   NUMERIC(10,2) NOT NULL,
  commission     NUMERIC(10,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  paid_at        TIMESTAMPTZ,
  reversed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AI Agents ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_agents (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  enabled      BOOLEAN NOT NULL DEFAULT FALSE,
  permissions  TEXT NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Agent Knowledge ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_knowledge (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Agent Activity ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_activity (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Calls ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id          TEXT PRIMARY KEY,
  booking_id  TEXT NOT NULL UNIQUE REFERENCES bookings(id),
  room_id     TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'pending',
  started_at  TIMESTAMPTZ,
  ended_at    TIMESTAMPTZ,
  duration    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Invite Codes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_codes (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  created_by  TEXT REFERENCES users(id),
  used_by     TEXT REFERENCES users(id),
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Partners ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT '',
  audience_size   INTEGER NOT NULL DEFAULT 0,
  category        TEXT NOT NULL DEFAULT '',
  location        TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'pending',
  social_url      TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Platform Config ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default config
INSERT INTO platform_config (key, value) VALUES
  ('platform_fee_pct',      '20'),
  ('referral_pct',          '20'),
  ('referral_duration_days','365'),
  ('invite_only',           'false'),
  ('min_booking_amount',    '5'),
  ('max_booking_amount',    '10000'),
  ('settlement_delay_hours','24')
ON CONFLICT (key) DO NOTHING;
