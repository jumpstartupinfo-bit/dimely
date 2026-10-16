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

export function createSession(userId: string): string {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400_000).toISOString()
  const id = crypto.randomUUID()

  db.prepare(`
    INSERT INTO sessions(id, user_id, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, tokenHash, expiresAt)

  return token
}

export function deleteSession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
}

export interface AuthUser {
  id: string
  email: string
  name: string
  username: string
  role: string
}

export function getSessionUser(token: string): AuthUser | null {
  const row = db.query<AuthUser, [string]>(`
    SELECT u.id, u.email, u.name, u.username, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > datetime('now')
  `).get(hashToken(token))

  return row ?? null
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }
  const user = getSessionUser(token)
  if (!user) {
    res.status(401).json({ error: 'Session expired or invalid' })
    return
  }
  ;(req as any).user = user
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return }
  const user = getSessionUser(token)
  if (!user || user.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return }
  ;(req as any).user = user
  next()
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req)
  if (token) {
    const user = getSessionUser(token)
    if (user) (req as any).user = user
  }
  next()
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}
