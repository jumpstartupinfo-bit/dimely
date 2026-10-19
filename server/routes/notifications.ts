import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'

const router = Router()

// GET /api/notifications
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { limit = '30', offset = '0' } = req.query

    const rows = await db.all(`
      SELECT * FROM notifications WHERE user_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3
    `, [user.id, parseInt(limit as string, 10), parseInt(offset as string, 10)])

    const unread = await db.get(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false', [user.id])

    res.json({ notifications: rows, unreadCount: parseInt(unread?.count ?? 0) })
  } catch (err) {
    console.error('Notifications error:', err)
    res.status(500).json({ error: 'Failed to fetch notifications.' })
  }
})

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    await db.run('UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2', [req.params.id, user.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark notification read.' })
  }
})

// POST /api/notifications/read-all
router.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    await db.run('UPDATE notifications SET read = true WHERE user_id = $1', [user.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all notifications read.' })
  }
})

export default router
