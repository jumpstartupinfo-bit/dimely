import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { id: string }
    const profile = await db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as { id: string } | undefined
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
    const windows = await db.prepare('SELECT * FROM availability WHERE profile_id = $1 ORDER BY day_of_week, start_time').all(profile.id)
    const exceptions = await db.prepare('SELECT * FROM availability_exceptions WHERE profile_id = $1 ORDER BY date ASC').all(profile.id)
    res.json({ windows, exceptions })
  } catch (err) {
    console.error('GET /availability error:', err)
    res.status(500).json({ error: 'Failed to load availability' })
  }
})

router.put('/windows', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { id: string }
    const profile = await db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as { id: string } | undefined
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

    const { windows } = req.body
    if (!Array.isArray(windows)) { res.status(400).json({ error: 'windows array required' }); return }

    await db.prepare('DELETE FROM availability WHERE profile_id = $1').run(profile.id)
    for (const w of windows) {
      await db.prepare(
        `INSERT INTO availability(id, profile_id, day_of_week, start_time, end_time, buffer_before, buffer_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`
      ).run(newId(), profile.id, w.day_of_week, w.start_time, w.end_time, 0, 0)
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Save availability error:', err)
    res.status(500).json({ error: 'Failed to save availability' })
  }
})

router.post('/exceptions', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { id: string }
    const profile = await db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as { id: string } | undefined
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
    const { date, type, note } = req.body
    if (!date || !type) { res.status(400).json({ error: 'date and type required' }); return }
    const id = newId()
    await db.prepare(`INSERT INTO availability_exceptions(id, profile_id, date, type, note) VALUES ($1, $2, $3, $4, $5)`).run(id, profile.id, date, type, note ?? null)
    res.status(201).json({ id, date, type, note })
  } catch (err) {
    console.error('POST /availability/exceptions error:', err)
    res.status(500).json({ error: 'Failed to add exception' })
  }
})

router.delete('/exceptions/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as Record<string, unknown>).user as { id: string }
    const profile = await db.prepare('SELECT id FROM profiles WHERE user_id = $1').get(user.id) as { id: string } | undefined
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
    await db.prepare('DELETE FROM availability_exceptions WHERE id = $1 AND profile_id = $2').run(req.params.id, profile.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('DELETE /availability/exceptions error:', err)
    res.status(500).json({ error: 'Failed to delete exception' })
  }
})

export default router
