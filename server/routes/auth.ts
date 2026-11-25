import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import db, { withTransaction } from '../db'
import { ensureAccountRecords, provisionAccountRecords } from '../account-setup'
import { createSession, deleteSession, requireAuth, extractToken } from '../auth'
import { newId } from '../utils'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please wait and try again.' },
  standardHeaders: true,
  legacyHeaders: false,
})

router.post('/signup', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name, username } = req.body
    if (!email || !password || !name || !username) {
      res.status(400).json({ error: 'All fields are required' }); return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' }); return
    }
    if (!/^[a-z0-9-]{3,30}$/.test(username.toLowerCase())) {
      res.status(400).json({ error: 'Username must be 3-30 lowercase letters, numbers, or hyphens' }); return
    }

    const lowerEmail = email.toLowerCase()
    const lowerUsername = username.toLowerCase()

    const existingEmail = await db.get('SELECT id FROM users WHERE email = $1', [lowerEmail])
    if (existingEmail) { res.status(409).json({ error: 'An account with this email already exists' }); return }

    const existingUsername = await db.get('SELECT id FROM users WHERE username = $1', [lowerUsername])
    if (existingUsername) { res.status(409).json({ error: 'That username is already taken' }); return }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = newId()

    // All-or-nothing: if any step fails, nothing is left behind and the person can simply retry.
    await withTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO users(id, email, password_hash, name, username) VALUES ($1, $2, $3, $4, $5)`,
        [userId, lowerEmail, passwordHash, name, lowerUsername],
      )
      await provisionAccountRecords(tx, { id: userId, name, username: lowerUsername })
    })

    const token = await createSession(userId)
    res.status(201).json({
      token,
      user: { id: userId, email: lowerEmail, name, username: lowerUsername }
    })
  } catch (err) {
    // Two people signing up with the same email or username at the same moment
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'An account with this email or username already exists' }); return
    }
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Failed to create account. Please try again.' })
  }
})

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' }); return
    }
    const user = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]) as Record<string, unknown> | undefined
    if (!user) { res.status(401).json({ error: 'Invalid email or password' }); return }
    const valid = await bcrypt.compare(password, user.password_hash as string)
    if (!valid) { res.status(401).json({ error: 'Invalid email or password' }); return }
    // Heals an account whose signup stopped halfway (no profile, wallet, referral code or agent row)
    await ensureAccountRecords(user.id as string)
    const token = await createSession(user.id as string)
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const token = extractToken(req)
    if (token) await deleteSession(token)
    res.json({ ok: true })
  } catch (err) {
    console.error('Logout error:', err)
    res.status(500).json({ error: 'Logout failed' })
  }
})

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { id: string }
    await ensureAccountRecords(user.id)
    const profile = await db.get('SELECT * FROM profiles WHERE user_id = $1', [user.id])
    const refCode = await db.get(
      'SELECT code, link_slug FROM referral_codes WHERE user_id = $1', [user.id]
    ) as { code: string; link_slug: string } | undefined
    res.json({ user, profile, referralCode: refCode?.code, referralSlug: refCode?.link_slug })
  } catch (err) {
    console.error('/me error:', err)
    res.status(500).json({ error: 'Failed to load user' })
  }
})

export default router
