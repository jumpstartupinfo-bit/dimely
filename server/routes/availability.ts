import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/availability — get own availability
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const windows = db.prepare('SELECT * FROM availability WHERE profile_id = $1 ORDER BY day_of_week, start_time').all(profile.id)
  const exceptions = db.prepare('SELECT * FROM availability_exceptions WHERE profile_id = $1 ORDER BY date ASC').all(profile.id)

  res.json({ windows, exceptions })
})

// PUT /api/availability/windows — replace all windows
router.put('/windows', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const { windows } = req.body
  if (!Array.isArray(windows)) { res.status(400).json({ error: 'windows array required' }); return }

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM availability WHERE profile_id = $1').run(profile.id)
      for (const w of windows) {
        db.prepare(`
          INSERT INTO availability(id, profile_id, day_of_week, start_time, end_time, buffer_before, buffer_after)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `).run(newId(), profile.id, w.day_of_week, w.start_time, w.end_time, 0, 0)
      }
    })()
    res.json({ ok: true })
  } catch (err) {
    console.error('Save availability error:', err)
    res.status(500).json({ error: 'Failed to save availability' })
  }
})

// POST /api/availability/exceptions — add block/vacation
router.post('/exceptions', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const { date, type, note } = req.body
  if (!date || !type) { res.status(400).json({ error: 'date and type required' }); return }

  const id = newId()
  db.prepare(`INSERT INTO availability_exceptions(id, profile_id, date, type, note) VALUES ($1, $2, $3, $4, $5)`).run(id, profile.id, date, type, note ?? null)
  res.status(201).json({ id, date, type, note })
})

// DELETE /api/availability/exceptions/:id
router.delete('/exceptions/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as any
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
  db.prepare('DELETE FROM availability_exceptions WHERE id = $1 AND profile_id = $2').run(req.params.id, profile.id)
  res.json({ ok: true })
})

export default router
