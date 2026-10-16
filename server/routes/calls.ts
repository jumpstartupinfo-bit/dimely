import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/calls/:bookingId — get call state for a booking
router.get('/:bookingId', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.bookingId) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

  // Only participants can access call state
  if (booking.guest_user_id !== user.id && booking.host_user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  // Authorization checks
  if (['cancelled', 'refunded', 'expired'].includes(booking.status)) {
    res.status(403).json({ error: 'This booking is no longer active.', bookingStatus: booking.status }); return
  }
  if (booking.status === 'payment_pending') {
    res.status(403).json({ error: 'Payment is required before joining the call.', bookingStatus: booking.status }); return
  }
  if (booking.status === 'disputed') {
    res.status(403).json({ error: 'This booking is under review.', bookingStatus: booking.status }); return
  }

  let call = db.prepare('SELECT * FROM calls WHERE booking_id = ?').get(booking.id) as any

  if (!call) {
    // Create call record on first access
    const callId = newId()
    db.prepare(`
      INSERT INTO calls(id, booking_id, status) VALUES (?, ?, 'waiting')
    `).run(callId, booking.id)
    call = db.prepare('SELECT * FROM calls WHERE id = ?').get(callId)
  }

  // Server time for synchronization
  const serverNow = Date.now()
  const bookingStartUtc = new Date(`${booking.date}T${booking.start_time}:00Z`).getTime()
  const bookingEndUtc = bookingStartUtc + booking.duration * 60_000
  const msUntilStart = bookingStartUtc - serverNow
  const msUntilEnd = bookingEndUtc - serverNow

  res.json({
    call,
    booking: {
      id: booking.id,
      date: booking.date,
      startTime: booking.start_time,
      endTime: booking.end_time,
      duration: booking.duration,
      callType: booking.call_type,
      status: booking.status,
      hostUserId: booking.host_user_id,
      guestUserId: booking.guest_user_id,
    },
    serverNow,
    msUntilStart,
    msUntilEnd,
    role: user.id === booking.host_user_id ? 'host' : 'guest',
  })
})

// POST /api/calls/:bookingId/join — participant joins
router.post('/:bookingId/join', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.bookingId) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

  if (booking.guest_user_id !== user.id && booking.host_user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  if (!['confirmed', 'in_progress'].includes(booking.status)) {
    res.status(403).json({ error: 'Call is not available.' }); return
  }

  const isHost = user.id === booking.host_user_id
  const call = db.prepare('SELECT * FROM calls WHERE booking_id = ?').get(booking.id) as any

  if (!call) { res.status(404).json({ error: 'Call record not found' }); return }

  db.transaction(() => {
    if (isHost) {
      db.prepare(`UPDATE calls SET host_joined_at = COALESCE(host_joined_at, datetime('now')), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
    } else {
      db.prepare(`UPDATE calls SET guest_joined_at = COALESCE(guest_joined_at, datetime('now')), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
    }

    // Once both joined, mark in_progress
    const updated = db.prepare('SELECT * FROM calls WHERE booking_id = ?').get(booking.id) as any
    if (updated.host_joined_at && updated.guest_joined_at && call.status === 'waiting') {
      db.prepare(`UPDATE calls SET status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
      db.prepare(`UPDATE bookings SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(booking.id)
    }
  })()

  res.json({ ok: true, role: isHost ? 'host' : 'guest' })
})

export default router
