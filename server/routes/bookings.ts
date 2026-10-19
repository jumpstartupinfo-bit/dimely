import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId, calcBookingAmounts, localTimeToUtc, addMinutes, formatUtcTime, formatUtcDate } from '../utils'
import { getPlatformFeePercent, getReferralCommissionPercent } from '../config'
import { createNotification } from '../notifications'
import {
  createPaymentIntent,
  verifyUsdcPayment,
  confirmBookingAfterPayment,
  settleBooking,
} from '../payment-service'
import { chainConfig, requireTreasury } from '../chain-config'

const router = Router()

// POST /api/bookings — create booking
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const {
      profileUsername,
      date,
      startTime,
      duration,
      callType,
      topic,
      guestName,
      guestEmail,
      guestTimezone,
      idempotencyKey,
    } = req.body

    if (!profileUsername || !date || !startTime || !duration || !callType || !topic || !guestName || !guestEmail) {
      res.status(400).json({ error: 'Missing required booking fields' }); return
    }
    if (![15, 30, 45, 60].includes(Number(duration))) {
      res.status(400).json({ error: 'Invalid duration. Choose 15, 30, 45, or 60 minutes.' }); return
    }
    if (!['voice', 'video'].includes(callType)) {
      res.status(400).json({ error: 'Invalid call type' }); return
    }

    // Idempotency
    if (idempotencyKey) {
      const existing = await db.get('SELECT id, status FROM bookings WHERE idempotency_key = $1', [idempotencyKey])
      if (existing) { res.status(200).json({ bookingId: existing.id, status: existing.status, idempotent: true }); return }
    }

    // Load host profile
    const profile = await db.get(`
      SELECT p.*, u.id as host_user_id FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.username = $1 AND p.published = true
    `, [profileUsername])
    if (!profile) { res.status(404).json({ error: 'Host profile not found' }); return }
    if (profile.host_user_id === user.id) { res.status(400).json({ error: 'You cannot book yourself' }); return }

    if (Number(duration) < profile.min_duration || Number(duration) > profile.max_duration) {
      res.status(400).json({ error: `Duration must be between ${profile.min_duration} and ${profile.max_duration} minutes` }); return
    }
    if (callType === 'video' && !profile.video_available) { res.status(400).json({ error: 'Video calls not available' }); return }
    if (callType === 'voice' && !profile.voice_available) { res.status(400).json({ error: 'Voice calls not available' }); return }

    const feePercent = getPlatformFeePercent()
    const { gross, platformFee, hostEarnings } = calcBookingAmounts(profile.price_per_min, Number(duration), feePercent)

    const hostTz = profile.timezone || 'UTC'
    const guestTz = guestTimezone || 'UTC'
    const startUtc = localTimeToUtc(date, startTime, hostTz)
    const endUtc = addMinutes(startUtc, Number(duration))
    const utcDate = formatUtcDate(startUtc)
    const utcStart = formatUtcTime(startUtc)
    const utcEnd = formatUtcTime(endUtc)

    // Check for conflict
    const conflict = await db.get(`
      SELECT id FROM bookings
      WHERE profile_id = $1 AND date = $2
      AND status NOT IN ('cancelled', 'refunded', 'expired')
      AND NOT (end_time <= $3 OR start_time >= $4)
    `, [profile.id, utcDate, utcStart, utcEnd])
    if (conflict) { res.status(409).json({ error: 'That time was just booked. Please choose another time.' }); return }

    const bookingId = newId()

    await db.run(`
      INSERT INTO bookings(
        id, guest_id, host_id, profile_id,
        date, start_time, end_time, duration_mins, call_type, topic,
        guest_name, guest_email,
        status, booking_amount, platform_fee, host_amount, idempotency_key
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'payment_pending',$13,$14,$15,$16)
    `, [bookingId, user.id, profile.host_user_id, profile.id,
        utcDate, utcStart, utcEnd, Number(duration), callType, topic,
        guestName, guestEmail,
        gross, platformFee, hostEarnings, idempotencyKey ?? null])

    await db.run(`
      INSERT INTO escrow(id, booking_id, held_amount, platform_fee, host_amount, status)
      VALUES ($1,$2,$3,$4,$5,'held')
    `, [newId(), bookingId, gross, platformFee, hostEarnings])

    await db.run(`UPDATE wallets SET held = held + $1 WHERE user_id = $2`, [hostEarnings, profile.host_user_id])

    createNotification(profile.host_user_id, 'new_booking', 'New booking request',
      `${guestName} wants to book a ${duration}-min ${callType} call.`, { bookingId })

    res.status(201).json({ bookingId, gross, platformFee, hostEarnings, status: 'payment_pending' })
  } catch (err) {
    console.error('Booking error:', err)
    res.status(500).json({ error: 'Failed to create booking. Please try again.' })
  }
})

// GET /api/bookings/:id/payment-intent
router.get('/:id/payment-intent', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'payment_pending') {
      res.status(400).json({ error: 'Booking is not awaiting payment', status: booking.status }); return
    }

    let treasuryAddress: string
    try {
      treasuryAddress = requireTreasury()
    } catch {
      if (chainConfig.env === 'testnet') {
        treasuryAddress = '0x0000000000000000000000000000000000000000'
      } else {
        res.status(503).json({ error: 'Payment system not configured.' }); return
      }
    }

    const idempotencyKey = `payment-intent-${booking.id}`
    const paymentId = createPaymentIntent({
      bookingId: booking.id,
      guestUserId: user.id,
      hostUserId: booking.host_id,
      grossAmount: booking.booking_amount,
      platformFee: booking.platform_fee,
      hostAmount: booking.host_amount,
      idempotencyKey,
    })

    res.json({
      paymentId,
      bookingId: booking.id,
      recipientAddress: treasuryAddress,
      usdcAddress: chainConfig.usdcAddress,
      chainId: chainConfig.chainId,
      grossAmount: booking.booking_amount,
      platformFee: booking.platform_fee,
      hostAmount: booking.host_amount,
      currency: 'USDC',
      network: chainConfig.env,
      status: 'awaiting_payment',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
  } catch (err) {
    console.error('Payment intent error:', err)
    res.status(500).json({ error: 'Failed to create payment intent.' })
  }
})

// POST /api/bookings/:id/verify-payment
router.post('/:id/verify-payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { txHash, paymentId, senderAddress } = req.body
    if (!txHash || !paymentId || !senderAddress) {
      res.status(400).json({ error: 'txHash, paymentId, and senderAddress are required' }); return
    }

    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'payment_pending') {
      res.status(400).json({ error: 'Booking is not awaiting payment', status: booking.status }); return
    }

    const payment = await db.get('SELECT * FROM payments WHERE id = $1 AND booking_id = $2', [paymentId, booking.id])
    if (!payment) { res.status(404).json({ error: 'Payment intent not found' }); return }

    let recipientAddress: string
    try {
      recipientAddress = requireTreasury()
    } catch {
      if (chainConfig.env === 'testnet') {
        confirmBookingAfterPayment(paymentId, booking.id, txHash, booking.host_id, booking.guest_id, booking.date, booking.start_time)
        res.json({ bookingId: booking.id, status: 'confirmed', txHash, demo: true }); return
      }
      res.status(503).json({ error: 'Payment system not configured.' }); return
    }

    const result = await verifyUsdcPayment({
      paymentId, bookingId: booking.id, txHash,
      expectedGrossAmount: booking.booking_amount,
      expectedSenderAddress: senderAddress,
      expectedRecipientAddress: recipientAddress,
    })

    if (!result.ok) {
      res.status(402).json({ error: result.error ?? 'Payment verification failed', status: 'failed' }); return
    }

    confirmBookingAfterPayment(paymentId, booking.id, txHash, booking.host_id, booking.guest_id, booking.date, booking.start_time)

    res.json({ bookingId: booking.id, status: 'confirmed', txHash, confirmedAmount: result.confirmedAmount, blockNumber: result.blockNumber?.toString() })
  } catch (err) {
    console.error('Verify payment error:', err)
    res.status(500).json({ error: 'Payment verification failed. Please try again.' })
  }
})

// POST /api/bookings/:id/confirm-payment — legacy compatibility
router.post('/:id/confirm-payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { txHash } = req.body
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'payment_pending') { res.status(400).json({ error: 'Booking is not awaiting payment' }); return }

    const idempotencyKey = `payment-intent-${booking.id}`
    const paymentId = createPaymentIntent({
      bookingId: booking.id, guestUserId: user.id, hostUserId: booking.host_id,
      grossAmount: booking.booking_amount, platformFee: booking.platform_fee,
      hostAmount: booking.host_amount, idempotencyKey,
    })
    confirmBookingAfterPayment(paymentId, booking.id, txHash ?? null, booking.host_id, booking.guest_id, booking.date, booking.start_time)
    res.json({ bookingId: booking.id, status: 'confirmed' })
  } catch (err) {
    console.error('Confirm payment error:', err)
    res.status(500).json({ error: 'Failed to confirm payment.' })
  }
})

// GET /api/bookings
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { role } = req.query
    let rows: any[]
    if (role === 'host') {
      rows = await db.all(`SELECT b.*, 'host' as role FROM bookings b WHERE b.host_id = $1 ORDER BY b.date DESC, b.start_time DESC`, [user.id])
    } else if (role === 'guest') {
      rows = await db.all(`SELECT b.*, 'guest' as role FROM bookings b WHERE b.guest_id = $1 ORDER BY b.date DESC, b.start_time DESC`, [user.id])
    } else {
      const asGuest = await db.all(`SELECT b.*, 'guest' as role FROM bookings b WHERE b.guest_id = $1`, [user.id])
      const asHost = await db.all(`SELECT b.*, 'host' as role FROM bookings b WHERE b.host_id = $1`, [user.id])
      rows = [...asGuest, ...asHost].sort((a, b) => (a.date + a.start_time) < (b.date + b.start_time) ? 1 : -1)
    }
    res.json({ bookings: rows })
  } catch (err) {
    console.error('GET /bookings error:', err)
    res.status(500).json({ error: 'Failed to fetch bookings.' })
  }
})

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id && booking.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    res.json(booking)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch booking.' })
  }
})

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { reason } = req.body
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    const isGuest = booking.guest_id === user.id
    const isHost = booking.host_id === user.id
    if (!isGuest && !isHost) { res.status(403).json({ error: 'Forbidden' }); return }
    if (!['confirmed', 'payment_pending'].includes(booking.status)) {
      res.status(400).json({ error: 'This booking cannot be cancelled in its current state' }); return
    }

    const bookingStart = new Date(`${booking.date}T${booking.start_time}:00Z`)
    const hoursUntil = (bookingStart.getTime() - Date.now()) / 3_600_000
    let refundAmount = 0
    if (isHost) { refundAmount = booking.booking_amount }
    else if (hoursUntil >= 24) { refundAmount = booking.booking_amount }
    else { refundAmount = Math.round(booking.booking_amount * 0.5 * 100) / 100 }

    await db.run(`UPDATE bookings SET status='cancelled', cancel_reason=$1, cancelled_at=NOW(), updated_at=NOW() WHERE id=$2`, [reason ?? null, booking.id])
    await db.run(`UPDATE escrow SET status='refunded', updated_at=NOW() WHERE booking_id=$1`, [booking.id])
    await db.run(`UPDATE wallets SET held=GREATEST(0,held-$1) WHERE user_id=$2`, [booking.host_amount, booking.host_id])
    await db.run(`INSERT INTO cancellations(id,booking_id,cancelled_by,reason,refund_amount) VALUES($1,$2,$3,$4,$5)`,
      [newId(), booking.id, user.id, reason ?? null, refundAmount])

    const notifyUserId = isHost ? booking.guest_id : booking.host_id
    createNotification(notifyUserId, 'booking_cancelled', 'Booking cancelled',
      `Your booking on ${booking.date} has been cancelled.${refundAmount > 0 ? ` Refund: $${refundAmount}.` : ''}`, { bookingId: booking.id })

    res.json({ bookingId: booking.id, status: 'cancelled', refundAmount })
  } catch (err) {
    console.error('Cancel error:', err)
    res.status(500).json({ error: 'Failed to cancel booking.' })
  }
})

// POST /api/bookings/:id/complete
router.post('/:id/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.host_id !== user.id && booking.guest_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      res.status(400).json({ error: 'Booking cannot be completed in its current state' }); return
    }

    await db.run(`UPDATE bookings SET status='completed', updated_at=NOW() WHERE id=$1`, [booking.id])

    const commissionPercent = getReferralCommissionPercent()
    const result = settleBooking(booking.id, commissionPercent)
    if (!result.ok) {
      res.json({ bookingId: booking.id, status: 'completed', note: result.error }); return
    }

    res.json({ bookingId: booking.id, status: 'completed', settlementId: result.settlementId, hostEarnings: result.hostEarnings, platformFee: result.platformFee })
  } catch (err) {
    console.error('Complete error:', err)
    res.status(500).json({ error: 'Failed to complete booking.' })
  }
})

// POST /api/bookings/:id/dispute
router.post('/:id/dispute', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { reason, details } = req.body
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [req.params.id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_id !== user.id && booking.host_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }

    await db.run(`UPDATE bookings SET status='disputed', updated_at=NOW() WHERE id=$1`, [booking.id])
    await db.run(`UPDATE escrow SET status='disputed', updated_at=NOW() WHERE booking_id=$1`, [booking.id])
    await db.run(`INSERT INTO disputes(id,booking_id,raised_by,reason,details) VALUES($1,$2,$3,$4,$5)`,
      [newId(), booking.id, user.id, reason, details ?? null])

    res.json({ bookingId: booking.id, status: 'disputed' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to raise dispute.' })
  }
})

export default router
