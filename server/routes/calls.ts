import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/calls/:bookingId
router.get('/:bookingId', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.bookingId])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id && booking.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (['cancelled', 'refunded', 'expired'].includes(booking.status)) {
      res.status(403).json({ error: 'This booking is no longer active.', bookingStatus: booking.status }); return
    }
    if (booking.status === 'payment_pending') {
      res.status(403).json({ error: 'Payment is required before joining the call.', bookingStatus: booking.status }); return
    }

    let call = await db.get('SELECT * FROM calls WHERE booking_id = $1', [booking.id])
    if (!call) {
      const callId = newId()
      await db.run(`INSERT INTO calls(id, booking_id, status) VALUES ($1, $2, 'waiting')`, [callId, booking.id])
      call = await db.get('SELECT * FROM calls WHERE id = $1', [callId])
    }

    const serverNow = Date.now()
    const bookingStartUtc = new Date(`${booking.date}T${booking.start_time}:00Z`).getTime()
    const bookingEndUtc = bookingStartUtc + booking.duration_mins * 60_000

    res.json({
      call,
      booking: {
        id: booking.id, date: booking.date, startTime: booking.start_time, endTime: booking.end_time,
        duration: booking.duration_mins, callType: booking.call_type, status: booking.status,
        hostUserId: booking.host_id, guestUserId: booking.guest_id,
      },
      serverNow,
      msUntilStart: bookingStartUtc - serverNow,
      msUntilEnd: bookingEndUtc - serverNow,
      role: user.id === booking.host_id ? 'host' : 'guest',
    })
  } catch (err) {
    console.error('GET call error:', err)
    res.status(500).json({ error: 'Failed to fetch call.' })
  }
})

// POST /api/calls/:bookingId/join
router.post('/:bookingId/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.bookingId])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id && booking.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (!['confirmed', 'in_progress'].includes(booking.status)) { res.status(403).json({ error: 'Call is not available.' }); return }

    const isHost = user.id === booking.host_id
    const call = await db.get('SELECT * FROM calls WHERE booking_id = $1', [booking.id])
    if (!call) { res.status(404).json({ error: 'Call record not found' }); return }

    if (isHost) {
      await db.run(`UPDATE calls SET host_joined_at=COALESCE(host_joined_at,NOW()), updated_at=NOW() WHERE booking_id=$1`, [booking.id])
    } else {
      await db.run(`UPDATE calls SET guest_joined_at=COALESCE(guest_joined_at,NOW()), updated_at=NOW() WHERE booking_id=$1`, [booking.id])
    }

    const updated = await db.get('SELECT * FROM calls WHERE booking_id = $1', [booking.id])
    if (updated.host_joined_at && updated.guest_joined_at && call.status === 'waiting') {
      await db.run(`UPDATE calls SET status='in_progress', started_at=NOW(), updated_at=NOW() WHERE booking_id=$1`, [booking.id])
      await db.run(`UPDATE bookings SET status='in_progress', updated_at=NOW() WHERE id=$1`, [booking.id])
    }

    res.json({ ok: true, role: isHost ? 'host' : 'guest' })
  } catch (err) {
    console.error('Join call error:', err)
    res.status(500).json({ error: 'Failed to join call.' })
  }
})

export default router
