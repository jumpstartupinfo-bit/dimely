# Dimely

> Book anyone. Anywhere.

Dimely is a global people-discovery and booking platform. Users discover and book calls with experts, creators, and professionals. Payment is in USDC on Arc. The platform takes a 20% fee; hosts keep 80%.

---

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS
- **Backend:** Express.js, Bun runtime, SQLite (dev) / Postgres via Supabase (prod)
- **Web3:** wagmi v2, viem v2, ConnectKit, USDC on Arc Testnet
- **Chain:** Arc Testnet (Chain ID: 5042002)
- **Token:** USDC (6 decimals, 0x3600000000000000000000000000000000000000 on Arc Testnet)
- **Deployment:** Vercel (frontend) + Railway (API) + Supabase (database)

---

## Key Rules

- Platform fee: 20% (server-side only — never trust client-submitted amounts)
- Referral commission: 20% of platform revenue (not gross), 12-month duration
- No star ratings or reviews — ever
- Invite-only mode: configurable in admin dashboard
- All financial calculations are server-authoritative
- Never expose private keys or server secrets to the frontend

---

## Project Structure

```
src/                  React frontend
  components/         Shared UI components (Nav, Logo, UsdcPaymentButton)
  pages/              Full-page views (Discover, Profile, BookingFlow, etc.)
  context/            AuthContext (session + login/logout)
  lib/api.ts          Typed API client — all fetch calls go through here
  onchain-facts.ts    Chain/token registry (never hardcode addresses)
  onchain-money.ts    USDC amount helpers
server/
  index.ts            Express entry point (port 3001)
  db.ts               SQLite/Postgres database + compat shim
  auth.ts             JWT sessions + middleware
  config.ts           Platform config accessors
  payment-service.ts  On-chain payment verification + escrow lifecycle
  chain-config.ts     Arc network config (reads from env vars)
  seed-profiles.ts    Demo profile seeder
  routes/             Express route handlers
    auth.ts           /api/auth/*
    profiles.ts       /api/profiles/*
    bookings.ts       /api/bookings/*
    earnings.ts       /api/earnings/*
    notifications.ts  /api/notifications/*
    referrals.ts      /api/referrals/*
    ai-agent.ts       /api/ai-agent/*
    admin.ts          /api/admin/*
supabase/
  schema.sql          Postgres schema for Supabase
```

---

## Environment Variables

See `.env.example` for all required vars. Key ones:

- `DATABASE_URL` — Supabase Postgres connection string
- `JWT_SECRET` — random secret for session tokens
- `TREASURY_ADDRESS` — wallet that receives USDC payments
- `SERVER_SIGNER_PRIVATE_KEY` — signs host withdrawal transactions
- `FRONTEND_URL` — Vercel frontend URL (for CORS)

---

## Running Locally

```bash
bun install
bun run server/index.ts   # API on port 3001
bun run dev               # Frontend on port 5173
```

## Checks

```bash
bun run check   # lint + typecheck (must pass 0 errors)
```
