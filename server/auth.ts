import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import db from './db'

const SESSION_DURATION_DAYS = 30

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateToken(): string {
  return crypto.randomBytes(48).toString('hex')
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400_000).toISOString()
  const id = crypto.randomUUID()
  await db.prepare(
    `INSERT INTO sessions(id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`
  ).run(id, userId, tokenHash, expiresAt)
  return token
}

export async function deleteSession(token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token_hash = $1').run(hashToken(token))
}

export interface AuthUser {
  id: string
  email: string
  name: string
  username: string
  role: string
}

export async function getSessionUser(token: string): Promise<AuthUser | null> {
  const row = await db.prepare(`
    SELECT u.id, u.email, u.name, u.username, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1 AND s.expires_at > NOW()
  `).get(hashToken(token)) as AuthUser | undefined
  return row ?? null
}

export function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
  getSessionUser(token).then((user) => {
    if (!user) { res.status(401).json({ error: 'Session expired or invalid' }); return }
    ;(req as Record<string, unknown>).user = user
    next()
  }).catch(() => res.status(500).json({ error: 'Auth error' }))
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
  getSessionUser(token).then((user) => {
    if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return }
    ;(req as Record<string, unknown>).user = user
    next()
  }).catch(() => res.status(500).json({ error: 'Auth error' }))
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) { next(); return }
  getSessionUser(token).then((user) => {
    if (user) (req as Record<string, unknown>).user = user
    next()
  }).catch(() => next())
}
