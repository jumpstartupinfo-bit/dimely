import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'
import {
  isDailyConfigured,
  roomNameFor,
  roomUrlFor,
  ensureRoom,
  createMeetingToken,
  verifyWebhookSignature,
} from '../daily'
import { JOIN_EARLY_MS, HARD_STOP_AFTER_END_MS } from '../call-outcome'

const router = Router()

type CallState = 'too_early' | 'open' | 'ended' | 'unavailable'

interface BookingRow {
  id: string
  host_id: string
  guest_id: string
  date: string
  start_time: string
  duration_mins: number | string
  call_type: string
  status: string
  outcome: string | null
  guest_name: string | null
  host_name: string | null
}

async function loadBooking(bookingId: string): Promise<BookingRow | undefined> {
  return (await db.get(
    `SELECT b.id, b.host_id, b.guest_id, b.date, b.start_time, b.duration_mins, b.call_type,
            b.status, b.outcome, b.guest_name, hp.name AS host_name
     FROM bookings b
     LEFT JOIN profiles hp ON hp.id = b.profile_id
     WHERE b.id = $1`,
    [bookingId],
  )) as BookingRow | undefined
}

function timing(b: BookingRow) {
  const startMs = new Date(`${b.date}T${b.start_time}:00Z`).getTime()
  const endMs = startMs + Number(b.duration_mins) * 60_000
  return { startMs, endMs, opensMs: startMs - JOIN_EARLY_MS }
}

function stateFor(b: BookingRow, now: number): { state: CallState; reason?: string } {
  if (b.status === 'payment_pending') return { state: 'unavailable', reason: 'Payment is required before joining the call.' }
  if (['cancelled', 'refunded', 'expired'].includes(b.status)) return { state: 'unavailable', reason: 'This booking is no longer active.' }
  if (['completed', 'disputed'].includes(b.status)) return { state: 'ended' }
  if (b.status !== 'confirmed') return { state: 'unavailable', reason: 'This call is not available.' }
  const { endMs, opensMs } = timing(b)
  if (now < opensMs) return { state: 'too_early' }
  if (now >= endMs) return { state: 'ended' }
  return { state: 'open' }
}

// GET /api/calls/:bookingId - what the call screen needs to know
router.get('/:bookingId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const b = await loadBooking(String(req.params.bookingId))
    if (!b) { res.status(404).json({ error: 'Booking not found' }); return }
    if (b.guest_id !== user.id && b.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const now = Date.now()
    const { state, reason } = stateFor(b, now)
    const { startMs, endMs, opensMs } = timing(b)
    const isHost = user.id === b.host_id

    res.json({
      state,
      reason: reason ?? null,
      role: isHost ? 'host' : 'guest',
      otherName: isHost ? (b.guest_name || 'Your guest') : (b.host_name || 'Your host'),
      date: b.date,
      startTime: b.start_time,
      duration: Number(b.duration_mins),
      callType: b.call_type,
      bookingStatus: b.status,
      outcome: b.outcome,
      serverNow: now,
      opensAt: opensMs,
      startsAt: startMs,
      endsAt: endMs,
    })
  } catch (err) {
    console.error('GET call error:', err)
    res.status(500).json({ error: 'Failed to load the call.' })
  }
})

// POST /api/calls/:bookingId/join - issue a private room link and token, only inside the window
router.post('/:bookingId/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const b = await loadBooking(String(req.params.bookingId))
    if (!b) { res.status(404).json({ error: 'Booking not found' }); return }
    if (b.guest_id !== user.id && b.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }

    const now = Date.now()
    const { state, reason } = stateFor(b, now)
    if (state === 'too_early') { res.status(403).json({ error: 'The call is not open yet. You can join 10 minutes before it starts.' }); return }
    if (state === 'ended') { res.status(403).json({ error: 'This call has ended.' }); return }
    if (state !== 'open') { res.status(403).json({ error: reason ?? 'This call is not available.' }); return }
    if (!isDailyConfigured()) { res.status(503).json({ error: 'Video calls are not available yet. Please try again shortly.' }); return }

    const { endMs, opensMs } = timing(b)
    const nbfSec = Math.floor(opensMs / 1000)
    const expSec = Math.ceil((endMs + HARD_STOP_AFTER_END_MS) / 1000)
    const roomName = roomNameFor(b.id)
    const isHost = user.id === b.host_id
    const userName = isHost ? (b.host_name || 'Host') : (b.guest_name || 'Guest')

    await ensureRoom({ name: roomName, nbfSec, expSec })
    const token = await createMeetingToken({
      roomName,
      userId: user.id,
      userName,
      nbfSec,
      expSec,
      startVideoOff: b.call_type === 'voice',
    })

    // Record the room and that this person was given access. Whether they actually joined is
    // decided from the video service's own signed events, not from this request.
    const existing = await db.get('SELECT id FROM calls WHERE booking_id = $1', [b.id])
    if (!existing) {
      await db.run(`INSERT INTO calls(id, booking_id, status) VALUES ($1, $2, 'waiting') ON CONFLICT DO NOTHING`, [newId(), b.id])
    }
    if (isHost) {
      await db.run(`UPDATE calls SET room_id=$1, host_token_at=COALESCE(host_token_at, NOW()) WHERE booking_id=$2`, [roomName, b.id])
    } else {
      await db.run(`UPDATE calls SET room_id=$1, guest_token_at=COALESCE(guest_token_at, NOW()) WHERE booking_id=$2`, [roomName, b.id])
    }

    res.json({ url: roomUrlFor(roomName), token, role: isHost ? 'host' : 'guest', expiresAt: expSec * 1000 })
  } catch (err) {
    console.error('Join call error:', err)
    res.status(500).json({ error: 'Could not start the call. Please try again.' })
  }
})

// POST /api/calls/webhook - signed events from the video service. No login; the signature is the proof.
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const raw = (req as any).rawBody as Buffer | undefined
    const rawBody = raw ? raw.toString('utf8') : ''
    const ok = verifyWebhookSignature(
      rawBody,
      req.body,
      req.header('X-Webhook-Timestamp'),
      req.header('X-Webhook-Signature'),
    )
    if (!ok) { res.status(401).json({ error: 'Invalid signature' }); return }

    const event = req.body as { test?: string; type?: string; payload?: Record<string, any> }
    if (event.test) { res.json({ ok: true }); return }

    const type = event.type
    const p = event.payload ?? {}
    if (type !== 'participant.joined' && type !== 'participant.left') { res.json({ ok: true, ignored: true }); return }

    const sessionId = typeof p.session_id === 'string' ? p.session_id : ''
    const roomName = typeof p.room === 'string' ? p.room : ''
    const userId = typeof p.user_id === 'string' ? p.user_id : ''
    const joinedAtSec = Number(p.joined_at)
    if (!sessionId || !roomName || !userId || !Number.isFinite(joinedAtSec)) { res.json({ ok: true, ignored: true }); return }

    const call = await db.get('SELECT booking_id FROM calls WHERE room_id = $1', [roomName])
    if (!call) { res.json({ ok: true, ignored: true }); return }
    const booking = await db.get('SELECT id, host_id, guest_id FROM bookings WHERE id = $1', [call.booking_id])
    if (!booking) { res.json({ ok: true, ignored: true }); return }

    const role = userId === booking.host_id ? 'host' : userId === booking.guest_id ? 'guest' : null
    if (!role) { res.json({ ok: true, ignored: true }); return }

    if (type === 'participant.joined') {
      // A repeat delivery for the same session is ignored by the primary key.
      await db.run(
        `INSERT INTO call_sessions(session_id, booking_id, user_id, role, joined_at)
         VALUES ($1,$2,$3,$4,to_timestamp($5::double precision))
         ON CONFLICT (session_id) DO NOTHING`,
        [sessionId, booking.id, userId, role, joinedAtSec],
      )
      const col = role === 'host' ? 'host_joined_at' : 'guest_joined_at'
      await db.run(`UPDATE calls SET ${col}=COALESCE(${col}, to_timestamp($1::double precision)) WHERE booking_id=$2`, [joinedAtSec, booking.id])
    } else {
      const durationSec = Number(p.duration)
      const leftAtSec = joinedAtSec + (Number.isFinite(durationSec) && durationSec >= 0 ? durationSec : 0)
      // Works even if the "left" event arrives before the "joined" event.
      await db.run(
        `INSERT INTO call_sessions(session_id, booking_id, user_id, role, joined_at, left_at)
         VALUES ($1,$2,$3,$4,to_timestamp($5::double precision),to_timestamp($6::double precision))
         ON CONFLICT (session_id) DO UPDATE SET left_at = COALESCE(call_sessions.left_at, EXCLUDED.left_at)`,
        [sessionId, booking.id, userId, role, joinedAtSec, leftAtSec],
      )
    }

    res.json({ ok: true })
  } catch (err) {
    console.error('Call webhook error:', err)
    // A server error makes the video service retry the delivery.
    res.status(500).json({ error: 'Webhook processing failed' })
  }
})

export default router
