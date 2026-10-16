import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { seedDemoProfiles } from './seed-profiles'

import authRouter from './routes/auth'
import profilesRouter from './routes/profiles'
import bookingsRouter from './routes/bookings'
import earningsRouter from './routes/earnings'
import notificationsRouter from './routes/notifications'
import referralsRouter from './routes/referrals'
import aiAgentRouter from './routes/ai-agent'
import availabilityRouter from './routes/availability'
import adminRouter from './routes/admin'
// chain config is loaded at import time to validate env vars early
import './chain-config'
import callsRouter from './routes/calls'

const app = express()
const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001

// ─── Security middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))

// Allow multiple origins: local dev + Vercel preview + production frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
]
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, same-origin)
    if (!origin) { cb(null, true); return }
    // Allow any Vercel preview URL for this project
    if (/https:\/\/dimely.*\.vercel\.app$/.test(origin)) { cb(null, true); return }
    if (allowedOrigins.includes(origin)) { cb(null, true); return }
    cb(null, false)
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))

// Global rate limiter
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
}))

// ─── Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter)
app.use('/api/profiles', profilesRouter)
app.use('/api/bookings', bookingsRouter)
app.use('/api/earnings', earningsRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/referrals', referralsRouter)
app.use('/api/ai-agent', aiAgentRouter)
app.use('/api/availability', availabilityRouter)
app.use('/api/admin', adminRouter)
app.use('/api/calls', callsRouter)

// ─── Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() })
})

// ─── 404 handler ──────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ─── Error handler ─────────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'An unexpected error occurred. Please try again.' })
})

// Seed demo profiles before accepting requests
try {
  seedDemoProfiles()
  console.log('Demo profiles seeded')
} catch (e) {
  console.warn('Seed error (non-fatal):', e)
}

app.listen(PORT, () => {
  console.log(`Dimely API running on http://localhost:${PORT}`)
})

export default app
