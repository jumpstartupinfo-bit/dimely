import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import db from '../db'
import { createSession, deleteSession, requireAuth, extractToken } from '../auth'
import { newId, generateReferralCode, generateReferralSlug } from '../utils'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please wait and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// POST /api/auth/signup
router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name, username, inviteCode } = req.body

    if (!email || !password || !name || !username) {
      res.status(400).json({ error: 'All fields are required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }
    if (!/^[a-z0-9-]{3,30}$/.test(username)) {
      res.status(400).json({ error: 'Username must be 3–30 lowercase letters, numbers, or hyphens' })
      return
    }

    const inviteOnly = (getConfig('invite_only') ?? 'false') === 'true'

    // Invite-only check
    let referredBy: string | null = null
    let referralCodeId: string | null = null

    if (inviteCode) {
      // Check referral_codes table first
      const refCode = db.prepare(`
        SELECT rc.id, rc.user_id FROM referral_codes rc
        JOIN users u ON u.id = rc.user_id
        WHERE rc.code = ? AND rc.is_active = 1
      `).get(inviteCode.trim().toUpperCase()) as { id: string; user_id: string } | undefined

      if (refCode) {
        referredBy = refCode.user_id
        referralCodeId = refCode.id
      } else {
        // Check invite_codes table
        const inv = db.prepare(`
          SELECT id, created_by FROM invite_codes
          WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
          AND use_count < max_uses
        `).get(inviteCode.trim().toUpperCase()) as { id: string; created_by: string | null } | undefined

        if (!inv && inviteOnly) {
          res.status(403).json({ error: 'A valid invite code is required to join Dimely.' })
          return
        }
        if (inv) {
          referredBy = inv.created_by
          // Mark invite used
          db.prepare(`UPDATE invite_codes SET use_count = use_count + 1, used_at = datetime('now') WHERE id = ?`).run(inv.id)
        }
      }

    // Self-referral prevention
    if (referredBy) {
      const referrer = db.prepare('SELECT username FROM users WHERE id = ?').get(referredBy) as { username: string } | undefined
      if (referrer?.username === username) {
        res.status(400).json({ error: 'Self-referral is not allowed.' })
        return
      }
    }

    // Check uniqueness
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
    if (existingEmail) { res.status(409).json({ error: 'An account with this email already exists' }); return }

    const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase())
    if (existingUsername) { res.status(409).json({ error: 'That username is already taken' }); return }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = newId()

    // Atomic signup: user + wallet + profile + referral_code + referral_relationship
    const doSignup = db.transaction(() => {
      db.prepare(`
        INSERT INTO users(id, email, password_hash, name, username, referred_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, email.toLowerCase(), passwordHash, name, username.toLowerCase(), referredBy)

      db.prepare(`INSERT INTO wallets(user_id) VALUES (?)`).run(userId)

      const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
      const colors = ['#6366F1', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777']
      const color = colors[Math.floor(Math.random() * colors.length)]
      const profileId = newId()

      db.prepare(`
        INSERT INTO profiles(id, user_id, username, name, headline, avatar_initials, avatar_color, published)
        VALUES (?, ?, ?, ?, '', ?, ?, 1)
      `).run(profileId, userId, username.toLowerCase(), name, initials, color)

      const refCode = generateReferralCode(username)
      const refSlug = generateReferralSlug(username)
      db.prepare(`
        INSERT INTO referral_codes(id, user_id, code, link_slug)
        VALUES (?, ?, ?, ?)
      `).run(newId(), userId, refCode, refSlug)

      db.prepare(`
        INSERT INTO ai_agents(id, user_id) VALUES (?, ?)
      `).run(newId(), userId)

      // Create referral relationship if referred
      if (referredBy && referralCodeId) {
        const durationMonths = parseInt(getConfig('referral_duration_months') ?? '12', 10)
        const expiresAt = new Date()
        expiresAt.setMonth(expiresAt.getMonth() + durationMonths)

        // Circular referral check
        const isCircular = db.prepare(`
          SELECT id FROM referral_relationships WHERE referrer_id = ?
        `).get(userId)

        if (!isCircular) {
          db.prepare(`
            INSERT INTO referral_relationships(id, referrer_id, referred_id, referral_code_id, status, activated_at, expires_at)
            VALUES (?, ?, ?, ?, 'active', datetime('now'), ?)
          `).run(newId(), referredBy, userId, referralCodeId, expiresAt.toISOString())
        }
      }
    })

    doSignup()

    const token = createSession(userId)

    res.status(201).json({
      token,
      user: { id: userId, email: email.toLowerCase(), name, username: username.toLowerCase() },
    })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Failed to create account. Please try again.' })
  }
})

// POST /api/auth/login
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) { res.status(400).json({ error: 'Email and password are required' }); return }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as any
    if (!user) { res.status(401).json({ error: 'Invalid email or password' }); return }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) { res.status(401).json({ error: 'Invalid email or password' }); return }

    const token = createSession(user.id)
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, (req: Request, res: Response) => {
  const token = (req.headers.authorization ?? '').slice(7)
  if (token) deleteSession(token)
  res.json({ ok: true })
})

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id) as any
  const refCode = db.prepare('SELECT code, link_slug FROM referral_codes WHERE user_id = ?').get(user.id) as any
  res.json({ user, profile, referralCode: refCode?.code, referralSlug: refCode?.link_slug })
})

export default router
