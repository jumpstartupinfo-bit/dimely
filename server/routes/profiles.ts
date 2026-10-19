import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth, optionalAuth } from '../auth'

const router = Router()

function tryParse(v: unknown, fallback: unknown): unknown {
  if (typeof v !== 'string') return fallback
  try { return JSON.parse(v) } catch { return fallback }
}

async function computeAvailability(profileId: string): Promise<{ availableToday: boolean; nextAvailable: string }> {
  const todayUtc = new Date()
  function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }

  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(todayUtc)
    d.setUTCDate(d.getUTCDate() + offset)
    const dow = d.getUTCDay()
    const dateStr = isoDate(d)

    const windows = await db.prepare(
      `SELECT start_time, end_time FROM availability WHERE profile_id = $1 AND day_of_week = $2`
    ).all(profileId, dow) as Array<{ start_time: string; end_time: string }>
    if (windows.length === 0) continue

    const booked = await db.prepare(
      `SELECT start_time FROM bookings WHERE profile_id = $1 AND date = $2 AND status NOT IN ('cancelled','refunded','expired')`
    ).all(profileId, dateStr) as Array<{ start_time: string }>
    const bookedSet = new Set(booked.map((r) => r.start_time))

    for (const w of windows) {
      const [sh, sm] = w.start_time.split(':').map(Number)
      const [eh, em] = w.end_time.split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em
      while (cur + 30 <= end) {
        const hh = String(Math.floor(cur / 60)).padStart(2, '0')
        const mm = String(cur % 60).padStart(2, '0')
        if (!bookedSet.has(`${hh}:${mm}`)) {
          if (offset === 0) {
            const h = Math.floor(cur / 60), m = cur % 60
            const ampm = h >= 12 ? 'PM' : 'AM'
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
            return { availableToday: true, nextAvailable: `Today, ${h12}:${String(m).padStart(2, '0')} ${ampm}` }
          } else {
            const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]
            const monthName = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]
            return { availableToday: false, nextAvailable: `${dayName}, ${monthName} ${d.getUTCDate()}` }
          }
        }
        cur += 30
      }
    }
  }
  return { availableToday: false, nextAvailable: 'No availability' }
}

function buildProfileShape(r: Record<string, unknown>, avail?: { availableToday: boolean; nextAvailable: string }) {
  const tags = typeof r.tags === 'string' ? tryParse(r.tags, []) : (r.tags ?? [])
  const socialLinks = typeof r.social_links === 'string' ? tryParse(r.social_links, {}) : {}
  return {
    id: r.id,
    user_id: r.user_id,
    username: r.username,
    name: r.name,
    headline: r.headline ?? '',
    bio: r.bio ?? '',
    location: r.location ?? '',
    category: r.category ?? '',
    tags,
    price_per_min: parseFloat(String(r.price_per_min ?? 5)),
    min_duration: Number(r.min_duration ?? 15),
    max_duration: Number(r.max_duration ?? 60),
    voice_available: r.voice_available === true || r.voice_available === 1,
    video_available: r.video_available === true || r.video_available === 1,
    avatar_color: r.avatar_color ?? '#6366F1',
    avatar_initials: r.avatar_initials ?? '??',
    photo_url: r.photo_url ?? null,
    social_instagram: r.social_instagram ?? null,
    social_twitter: r.social_twitter ?? null,
    social_linkedin: r.social_linkedin ?? null,
    social_tiktok: r.social_tiktok ?? null,
    social_youtube: r.social_youtube ?? null,
    socialLinks,
    verified: r.verified === true || r.verified === 1,
    booking_count: Number(r.booking_count ?? 0),
    available_today: avail?.availableToday ?? false,
    next_available: avail?.nextAvailable ?? '',
  }
}

// ─── GET /api/profiles ────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { q, category, video, availableToday, maxPrice, limit = '20', offset = '0', exclude } = req.query

    const params: unknown[] = [true]
    const conditions: string[] = ['p.published = $1']
    let pi = 2

    if (q) {
      conditions.push(`(
        p.name ILIKE $${pi} OR p.username ILIKE $${pi} OR p.headline ILIKE $${pi}
        OR p.bio ILIKE $${pi} OR p.location ILIKE $${pi} OR p.category ILIKE $${pi}
      )`)
      params.push(`%${q}%`)
      pi++
    }
    if (category && category !== 'All') {
      conditions.push(`p.category = $${pi}`)
      params.push(category)
      pi++
    }
    if (video === 'true') {
      conditions.push(`p.video_available = $${pi}`)
      params.push(true)
      pi++
    }
    if (maxPrice) {
      const maxPerMin = Number(maxPrice) / 30
      conditions.push(`p.price_per_min <= $${pi}`)
      params.push(maxPerMin)
      pi++
    }
    if (exclude) {
      conditions.push(`p.username != $${pi}`)
      params.push(exclude)
      pi++
    }

    const where = conditions.join(' AND ')
    const lim = Math.min(Number(limit), 50)
    const off = Number(offset)

    const rows = await db.prepare(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE ${where} ORDER BY p.booking_count DESC LIMIT $${pi} OFFSET $${pi + 1}`
    ).all(...params, lim, off) as Record<string, unknown>[]

    const countRow = await db.prepare(
      `SELECT COUNT(*) as total FROM profiles p JOIN users u ON u.id = p.user_id WHERE ${where}`
    ).get(...params) as { total: string | number }

    const profiles = await Promise.all(
      rows.map(async (r) => {
        const avail = await computeAvailability(r.id as string)
        if (availableToday === 'true' && !avail.availableToday) return null
        return buildProfileShape(r, avail)
      })
    )

    res.json({
      profiles: profiles.filter(Boolean),
      total: Number(countRow?.total ?? 0),
    })
  } catch (err) {
    console.error('GET /profiles error:', err)
    res.status(500).json({ error: 'Failed to load profiles' })
  }
})

// ─── GET /api/profiles/:username ──────────────────────────────────────────────
router.get('/:username', optionalAuth, async (req: Request, res: Response) => {
  try {
    const reqUser = (req as Record<string, unknown>).user as { id: string } | undefined
    const row = await db.prepare(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.username = $1`
    ).get(req.params.username) as Record<string, unknown> | undefined

    if (!row) { res.status(404).json({ error: 'Profile not found' }); return }
    if (!row.published && (!reqUser || reqUser.id !== row.user_id)) {
      res.status(404).json({ error: 'Profile not found' }); return
    }

    const avail = await computeAvailability(row.id as string)
    res.json({ profile: buildProfileShape(row, avail) })
  } catch (err) {
    console.error('GET /profiles/:username error:', err)
    res.status(500).json({ error: 'Failed to load profile' })
  }
})

// ─── PATCH /api/profiles/:username ────────────────────────────────────────────
router.patch('/:username', requireAuth, async (req: Request, res: Response) => {
  try {
    const reqUser = (req as Record<string, unknown>).user as { id: string }
    const profile = await db.prepare(
      `SELECT id, user_id FROM profiles WHERE username = $1`
    ).get(req.params.username) as { id: string; user_id: string } | undefined

    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
    if (profile.user_id !== reqUser.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const allowed = ['headline','bio','location','photo_url','category','tags','price_per_min','min_duration','max_duration','voice_available','video_available','social_instagram','social_twitter','social_linkedin','social_tiktok','social_youtube']
    const sets: string[] = []
    const vals: unknown[] = []
    let pi = 1

    for (const key of allowed) {
      if (key in req.body) {
        let val = req.body[key]
        if (key === 'tags' && Array.isArray(val)) val = JSON.stringify(val)
        sets.push(`${key} = $${pi}`)
        vals.push(val)
        pi++
      }
    }

    if (sets.length === 0) { res.status(400).json({ error: 'Nothing to update' }); return }
    vals.push(profile.id)
    await db.prepare(`UPDATE profiles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${pi}`).run(...vals)

    const updated = await db.prepare(
      `SELECT p.*, u.email FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.id = $1`
    ).get(profile.id) as Record<string, unknown>
    res.json({ profile: buildProfileShape(updated) })
  } catch (err) {
    console.error('PATCH /profiles/:username error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
})

// ─── GET /api/profiles/:username/availability ─────────────────────────────────
router.get('/:username/availability', async (req: Request, res: Response) => {
  try {
    const { date } = req.query
    const profile = await db.prepare(
      `SELECT id, timezone, price_per_min, min_duration, max_duration FROM profiles WHERE username = $1 AND published = true`
    ).get(req.params.username) as Record<string, unknown> | undefined

    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
    if (!date) { res.status(400).json({ error: 'date query param required' }); return }

    const dateStr = date as string
    const d = new Date(dateStr + 'T00:00:00Z')
    const dow = d.getUTCDay()

    const windows = await db.prepare(
      `SELECT start_time, end_time FROM availability WHERE profile_id = $1 AND day_of_week = $2`
    ).all(profile.id, dow) as Array<{ start_time: string; end_time: string }>

    if (windows.length === 0) { res.json({ slots: [] }); return }

    const booked = await db.prepare(
      `SELECT start_time, duration_min FROM bookings WHERE host_profile_id = $1 AND date = $2 AND status NOT IN ('cancelled','refunded','expired')`
    ).all(profile.id, dateStr) as Array<{ start_time: string; duration_min: number }>

    const minDur = Number(profile.min_duration ?? 15)
    const blockedSlots = new Set<string>()
    for (const b of booked) {
      const [bh, bm] = b.start_time.split(':').map(Number)
      const startMin = bh * 60 + bm
      for (let i = 0; i < b.duration_min; i += 15) {
        const t = startMin + i
        blockedSlots.add(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`)
      }
    }

    const slots: string[] = []
    for (const w of windows) {
      const [sh, sm] = w.start_time.split(':').map(Number)
      const [eh, em] = w.end_time.split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em
      while (cur + minDur <= end) {
        const hh = String(Math.floor(cur / 60)).padStart(2, '0')
        const mm = String(cur % 60).padStart(2, '0')
        const slot = `${hh}:${mm}`
        if (!blockedSlots.has(slot)) slots.push(slot)
        cur += 30
      }
    }

    res.json({ slots, pricePerMin: profile.price_per_min, minDuration: minDur })
  } catch (err) {
    console.error('GET /profiles/:username/availability error:', err)
    res.status(500).json({ error: 'Failed to load availability' })
  }
})

export default router
