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

    const existingEmail = await db.prepare('SELECT id FROM users WHERE email = $1').get(email.toLowerCase())
    if (existingEmail) { res.status(409).json({ error: 'An account with this email already exists' }); return }

    const existingUsername = await db.prepare('SELECT id FROM users WHERE username = $1').get(username.toLowerCase())
    if (existingUsername) { res.status(409).json({ error: 'That username is already taken' }); return }

    const passwordHash = await bcrypt.hash(password, 12)
    const userId = newId()
    const lowerUsername = username.toLowerCase()
    const lowerEmail = email.toLowerCase()

    await db.prepare(
      `INSERT INTO users(id, email, password_hash, name, username) VALUES ($1, $2, $3, $4, $5)`
    ).run(userId, lowerEmail, passwordHash, name, lowerUsername)

    await db.prepare(`INSERT INTO wallets(user_id) VALUES ($1)`).run(userId)

    const initials = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    const colors = ['#6366F1', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const profileId = newId()

    await db.prepare(
      `INSERT INTO profiles(id, user_id, username, name, headline, avatar_initials, avatar_color, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`
    ).run(profileId, userId, lowerUsername, name, '', initials, color, true)

    const refCode = generateReferralCode(lowerUsername)
    const refSlug = generateReferralSlug(lowerUsername)
    await db.prepare(
      `INSERT INTO referral_codes(id, user_id, code, link_slug) VALUES ($1, $2, $3, $4)`
    ).run(newId(), userId, refCode, refSlug)

    await db.prepare(`INSERT INTO ai_agents(id, user_id) VALUES ($1, $2)`).run(newId(), userId)

    const token = await createSession(userId)
    res.status(201).json({
      token,
      user: { id: userId, email: lowerEmail, name, username: lowerUsername }
    })
  } catch (err) {
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
    const user = await db.prepare('SELECT * FROM users WHERE email = $1').get(email.toLowerCase()) as Record<string, unknown> | undefined
    if (!user) { res.status(401).json({ error: 'Invalid email or password' }); return }
    const valid = await bcrypt.compare(password, user.password_hash as string)
    if (!valid) { res.status(401).json({ error: 'Invalid email or password' }); return }
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
    const profile = await db.prepare('SELECT * FROM profiles WHERE user_id = $1').get(user.id)
    const refCode = await db.prepare('SELECT code, link_slug FROM referral_codes WHERE user_id = $1').get(user.id) as { code: string; link_slug: string } | undefined
    res.json({ user, profile, referralCode: refCode?.code, referralSlug: refCode?.link_slug })
  } catch (err) {
    console.error('/me error:', err)
    res.status(500).json({ error: 'Failed to load user' })
  }
})

export default router
