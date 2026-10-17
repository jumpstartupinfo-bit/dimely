import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth, optionalAuth } from '../auth'

const router = Router()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tryParse(str: string, fallback: unknown): unknown {
  try { return JSON.parse(str) } catch { return fallback }
}

/**
 * For a profile, compute whether they have availability today (UTC) and their
 * next available slot label. We do a lightweight check against the availability
 * windows and a count of existing bookings — no full slot expansion needed.
 */
function computeAvailability(profileId: string): { availableToday: boolean; nextAvailable: string } {
  const todayUtc = new Date()
  const todayDow = todayUtc.getUTCDay() // 0=Sun

  // Format a date as YYYY-MM-DD in UTC
  function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10)
  }

  // Check up to 14 days ahead
  for (let offset = 0; offset < 14; offset++) {
    const d = new Date(todayUtc)
    d.setUTCDate(d.getUTCDate() + offset)
    const dow = d.getUTCDay()
    const dateStr = isoDate(d)

    // Check for a full-day exception blocking this date
    const exception = db.prepare(
      `SELECT type FROM availability_exceptions WHERE profile_id = ? AND date = ?`
    ).get(profileId, dateStr)
    if (exception) continue

    // Check if there are any recurring availability windows this day
    const windows = db.prepare(
      `SELECT start_time, end_time FROM availability WHERE profile_id = ? AND day_of_week = ?`
    ).all(profileId, dow) as Array<{ start_time: string; end_time: string }>
    if (windows.length === 0) continue

    // Generate 30-min slots and see if any are free
    const bookedSet = new Set<string>(
      (db.prepare(
        `SELECT start_time FROM bookings WHERE host_profile_id = ? AND date = ? AND status NOT IN ('cancelled','refunded','expired')`
      ).all(profileId, dateStr) as Array<{ start_time: string }>).map((r) => r.start_time)
    )
    const reservedSet = new Set<string>(
      (db.prepare(
        `SELECT start_time FROM slot_reservations WHERE profile_id = ? AND date = ? AND expires_at > datetime('now')`
      ).all(profileId, dateStr) as Array<{ start_time: string }>).map((r) => r.start_time)
    )

    for (const w of windows) {
      const [sh, sm] = w.start_time.split(':').map(Number)
      const [eh, em] = w.end_time.split(':').map(Number)
      let cur = sh * 60 + sm
      const end = eh * 60 + em
      while (cur + 30 <= end) {
        const hh = String(Math.floor(cur / 60)).padStart(2, '0')
        const mm = String(cur % 60).padStart(2, '0')
        const slot = `${hh}:${mm}`
        if (!bookedSet.has(slot) && !reservedSet.has(slot)) {
          // Found a free slot
          const isToday = offset === 0
          if (isToday) {
            // Format as "Today, H:MM AM/PM"
            const h = Math.floor(cur / 60)
            const m = cur % 60
            const ampm = h >= 12 ? 'PM' : 'AM'
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
            const label = `Today, ${h12}:${String(m).padStart(2, '0')} ${ampm}`
            return { availableToday: true, nextAvailable: label }
          } else {
            // Format as "DayName, MMM D"
            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]
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

function buildProfileShape(r: Record<string, unknown>, includeAvailability = false) {
  const base = {
    id: r.id,
    user_id: r.user_id,
    username: r.username,
    name: r.name,
    headline: r.headline,
    bio: r.bio,
    location: r.location,
    timezone: r.timezone,
    category: r.category,
    tags: tryParse(r.tags as string, []),
    price_per_min: r.price_per_min,
    min_duration: r.min_duration,
    max_duration: r.max_duration,
    voice_available: r.voice_available,
    video_available: r.video_available,
    avatar_color: r.avatar_color,
    avatar_initials: r.avatar_initials,
    verified: r.verified,
    published: r.published,
    booking_count: r.booking_count,
    socialLinks: {
      instagram: r.social_instagram ?? null,
      twitter: r.social_twitter ?? null,
      linkedin: r.social_linkedin ?? null,
      tiktok: r.social_tiktok ?? null,
      youtube: r.social_youtube ?? null,
    },
    // raw columns kept for compat
    social_instagram: r.social_instagram,
    social_twitter: r.social_twitter,
    social_linkedin: r.social_linkedin,
    social_tiktok: r.social_tiktok,
    social_youtube: r.social_youtube,
  }
  if (includeAvailability) {
    const avail = computeAvailability(r.id as string)
    return { ...base, available_today: avail.availableToday, next_available: avail.nextAvailable }
  }
  return base
}

// ─── GET /api/profiles ────────────────────────────────────────────────────────
router.get('/', optionalAuth, (req: Request, res: Response) => {
  const { q, category, availableToday, video, maxPrice, limit = '24', offset = '0' } = req.query

  let sql = `SELECT * FROM profiles WHERE published = true`
  const params: unknown[] = []
  let pIdx = 1

  if (q) {
    sql += ` AND (
      name ILIKE $${pIdx} OR headline ILIKE $${pIdx + 1} OR bio ILIKE $${pIdx + 2}
      OR tags ILIKE $${pIdx + 3} OR location ILIKE $${pIdx + 4} OR category ILIKE $${pIdx + 5}
    )`
    const like = `%${q}%`
    params.push(like, like, like, like, like, like)
    pIdx += 6
  }

  if (category && category !== 'All') {
    sql += ` AND (category = $${pIdx} OR tags ILIKE $${pIdx + 1})`
    params.push(category, `%${category}%`)
    pIdx += 2
  }

  if (video === 'true') {
    sql += ` AND video_available = true`
  }

  if (maxPrice) {
    sql += ` AND price_per_min <= $${pIdx}`
    params.push(parseFloat(maxPrice as string) / 30)
    pIdx += 1
  }

  sql += ` ORDER BY booking_count DESC, verified DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>

  // Build profile shapes with real availability
  let profiles = rows.map((r) => buildProfileShape(r, true))

  // availableToday filter is applied post-fetch since it requires availability computation
  if (availableToday === 'true') {
    profiles = profiles.filter((p) => p.available_today)
  }

  res.json({ profiles, total: profiles.length })
})

// ─── GET /api/profiles/:username ──────────────────────────────────────────────
router.get('/:username', optionalAuth, (req: Request, res: Response) => {
  if (req.params.username === 'me') { res.status(400).json({ error: 'Use /auth/me for own profile' }); return }

  // Owner can always see their own profile (published or not)
  const authUser = (req as Request & { user?: { id: string } }).user
  const row = db.prepare(
    `SELECT * FROM profiles WHERE username = $1 AND (published = true OR user_id = $2)`
  ).get(req.params.username, authUser?.id ?? '') as Record<string, unknown> | undefined

  if (!row) { res.status(404).json({ error: 'Profile not found' }); return }

  const profile = buildProfileShape(row, true)
  res.json(profile)
})

// ─── GET /api/profiles/:username/availability ─────────────────────────────────
router.get('/:username/availability', (req: Request, res: Response) => {
  const { date } = req.query // "YYYY-MM-DD"
  const profile = db.prepare(
    'SELECT id, timezone, price_per_min, min_duration, max_duration FROM profiles WHERE username = $1 AND published = true'
  ).get(req.params.username) as Record<string, unknown> | undefined

  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }
  if (!date) { res.status(400).json({ error: 'date query param required' }); return }

  const dateStr = date as string
  const dayOfWeek = new Date(dateStr + 'T12:00:00Z').getUTCDay()

  const windows = db.prepare(
    `SELECT * FROM availability WHERE profile_id = ? AND day_of_week = ?`
  ).all(profile.id, dayOfWeek) as Array<Record<string, unknown>>

  const exception = db.prepare(
    `SELECT * FROM availability_exceptions WHERE profile_id = ? AND date = ?`
  ).get(profile.id, dateStr)

  if (exception) { res.json({ slots: [], blocked: true, reason: (exception as Record<string,unknown>).type }); return }

  // Generate 30-min slots
  const slots: string[] = []
  for (const w of windows) {
    const [sh, sm] = (w.start_time as string).split(':').map(Number)
    const [eh, em] = (w.end_time as string).split(':').map(Number)
    let current = sh * 60 + sm
    const end = eh * 60 + em
    while (current + 30 <= end) {
      const hh = String(Math.floor(current / 60)).padStart(2, '0')
      const mm = String(current % 60).padStart(2, '0')
      slots.push(`${hh}:${mm}`)
      current += 30
    }
  }

  // Remove taken slots
  const bookedSlots = db.prepare(
    `SELECT start_time FROM bookings WHERE host_profile_id = ? AND date = ? AND status NOT IN ('cancelled', 'refunded', 'expired')`
  ).all(profile.id, dateStr) as Array<{ start_time: string }>

  const reservedSlots = db.prepare(
    `SELECT start_time FROM slot_reservations WHERE profile_id = ? AND date = ? AND expires_at > datetime('now')`
  ).all(profile.id, dateStr) as Array<{ start_time: string }>

  const taken = new Set([
    ...bookedSlots.map((b) => b.start_time),
    ...reservedSlots.map((r) => r.start_time),
  ])

  const available = slots.filter((s) => !taken.has(s))
  res.json({ slots: available, timezone: profile.timezone })
})

// ─── PATCH /api/profiles/me ───────────────────────────────────────────────────
router.patch('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as Request & { user: { id: string } }).user
  const profile = db.prepare('SELECT id FROM profiles WHERE user_id = ?').get(user.id) as { id: string } | undefined
  if (!profile) { res.status(404).json({ error: 'Profile not found' }); return }

  const allowed = [
    'headline', 'bio', 'location', 'timezone', 'category', 'tags',
    'price_per_min', 'min_duration', 'max_duration', 'voice_available', 'video_available',
    'social_instagram', 'social_twitter', 'social_linkedin', 'social_tiktok', 'social_youtube',
    'published', 'avatar_color', 'avatar_initials',
  ]
  const updates: string[] = []
  const vals: unknown[] = []

  for (const key of allowed) {
    if ((req.body as Record<string, unknown>)[key] !== undefined) {
      updates.push(`${key} = ?`)
      vals.push(key === 'tags' ? JSON.stringify((req.body as Record<string, unknown>)[key]) : (req.body as Record<string, unknown>)[key])
    }
  }

  if (updates.length === 0) { res.status(400).json({ error: 'No valid fields to update' }); return }

  updates.push(`updated_at = datetime('now')`)
  vals.push(profile.id)

  db.prepare(`UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`).run(...vals)

  const updated = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profile.id) as Record<string, unknown>
  res.json(buildProfileShape(updated, false))
})

export default router
