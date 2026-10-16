import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/availability — get own availability
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const windows = db.prepare('SELECT * FROM availability WHERE profile_id = ? ORDER BY day_of_week, start_time').all(profile.id)
  const exceptions = db.prepare('SELECT * FROM availability_exceptions WHERE profile_id = ? ORDER BY date ASC').all(profile.id)

  res.json({ windows, exceptions })
})

// PUT /api/availability/windows — replace all windows
router.put('/windows', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const { windows } = req.body
  if (!Array.isArray(windows)) { res.status(400).json({ error: 'windows array required' }); return }

  db.transaction(() => {
    db.prepare('DELETE FROM availability WHERE profile_id = ?').run(profile.id)
    for (const w of windows) {
      db.prepare(`
        INSERT INTO availability(id, profile_id, day_of_week, start_time, end_time, buffer_before, buffer_after)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newId(), profile.id, w.dayOfWeek, w.startTime, w.endTime, w.bufferBefore ?? 0, w.bufferAfter ?? 0)
    }
  })()

  res.json({ ok: true })
})

// POST /api/availability/exceptions — add block/vacation
router.post('/exceptions', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const { date, type, note } = req.body
  if (!date || !type) { res.status(400).json({ error: 'date and type required' }); return }

  const id = newId()
  db.prepare(`INSERT INTO availability_exceptions(id, profile_id, date, type, note) VALUES (?, ?, ?, ?, ?)`).run(id, profile.id, date, type, note ?? null)
  res.status(201).json({ id, date, type, note })
})

// DELETE /api/availability/exceptions/:id
router.delete('/exceptions/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
  db.prepare('DELETE FROM availability_exceptions WHERE id = ? AND profile_id = ?').run(req.params.id, profile.id)
  res.json({ ok: true })
})

export default router
