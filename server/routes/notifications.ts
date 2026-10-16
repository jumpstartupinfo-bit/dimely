import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'

const router = Router()

// GET /api/notifications
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const { limit = '30', offset = '0' } = req.query

  const rows = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(user.id, parseInt(limit as string, 10), parseInt(offset as string, 10)) as any[]

  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0').get(user.id) as any

  res.json({ notifications: rows, unreadCount: unreadCount.count })
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const result = db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, user.id)
  if (result.changes === 0) { res.status(404).json({ error: 'Notification not found' }); return }
  res.json({ ok: true })
})

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(user.id)
  res.json({ ok: true })
})

export default router
