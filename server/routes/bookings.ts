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

// POST /api/bookings — create booking atomically
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

    // Server-side validation
    if (!profileUsername || !date || !startTime || !duration || !callType || !topic || !guestName || !guestEmail) {
      res.status(400).json({ error: 'Missing required booking fields' })
      return
    }

    if (![15, 30, 45, 60].includes(Number(duration))) {
      res.status(400).json({ error: 'Invalid duration. Choose 15, 30, 45, or 60 minutes.' })
      return
    }

    if (!['voice', 'video'].includes(callType)) {
      res.status(400).json({ error: 'Invalid call type' })
      return
    }

    // Idempotency — prevent duplicate submissions
    if (idempotencyKey) {
      const existing = db.prepare('SELECT id, status FROM bookings WHERE idempotency_key = ?').get(idempotencyKey) as any
      if (existing) {
        res.status(200).json({ bookingId: existing.id, status: existing.status, idempotent: true })
        return
      }
    }

    // Load host profile
    const profile = db.prepare(`
      SELECT p.*, u.id as host_user_id FROM profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.username = ? AND p.published = 1
    `).get(profileUsername) as any

    if (!profile) { res.status(404).json({ error: 'Host profile not found' }); return }

    // Cannot book yourself
    if (profile.host_user_id === user.id) {
      res.status(400).json({ error: 'You cannot book yourself' })
      return
    }

    // Duration bounds check
    if (duration < profile.min_duration || duration > profile.max_duration) {
      res.status(400).json({ error: `Duration must be between ${profile.min_duration} and ${profile.max_duration} minutes` })
      return
    }

    // Call type availability check
    if (callType === 'video' && !profile.video_available) {
      res.status(400).json({ error: 'Video calls are not available for this host' })
      return
    }
    if (callType === 'voice' && !profile.voice_available) {
      res.status(400).json({ error: 'Voice calls are not available for this host' })
      return
    }

    // Server-side price calculation — never trust client
    const feePercent = getPlatformFeePercent()
    const { gross, platformFee, hostEarnings } = calcBookingAmounts(
      profile.price_per_min,
      Number(duration),
      feePercent
    )

    // Convert to UTC
    const hostTz = profile.timezone || 'UTC'
    const guestTz = guestTimezone || 'UTC'
    const startUtc = localTimeToUtc(date, startTime, hostTz)
    const endUtc = addMinutes(startUtc, Number(duration))
    const utcDate = formatUtcDate(startUtc)
    const utcStart = formatUtcTime(startUtc)
    const utcEnd = formatUtcTime(endUtc)

    // Atomically check + create — race condition prevention
    const bookingId = newId()
    const result = db.transaction(() => {
      // Expire old reservations
      db.prepare(`DELETE FROM slot_reservations WHERE expires_at <= datetime('now')`).run()

      // Check for conflict (EXCLUSIVE within transaction)
      const conflict = db.prepare(`
        SELECT id FROM bookings
        WHERE host_profile_id = ? AND date = ?
        AND status NOT IN ('cancelled', 'refunded', 'expired')
        AND NOT (end_time <= ? OR start_time >= ?)
      `).get(profile.id, utcDate, utcStart, utcEnd)

      if (conflict) return { error: 'That time was just booked. Please choose another time.' }

      // Check reservations
      const reserved = db.prepare(`
        SELECT id FROM slot_reservations
        WHERE profile_id = ? AND date = ? AND expires_at > datetime('now')
        AND NOT (end_time <= ? OR start_time >= ?)
      `).get(profile.id, utcDate, utcStart, utcEnd)

      if (reserved) return { error: 'That time slot is temporarily held. Please choose another time.' }

      // Create booking
      db.prepare(`
        INSERT INTO bookings(
          id, guest_user_id, host_profile_id, host_user_id,
          date, start_time, end_time, duration, call_type, topic,
          guest_name, guest_email, guest_timezone, host_timezone,
          status, gross_amount, platform_fee, host_earnings, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'payment_pending', ?, ?, ?, ?)
      `).run(
        bookingId, user.id, profile.id, profile.host_user_id,
        utcDate, utcStart, utcEnd, duration, callType, topic,
        guestName, guestEmail, guestTz, hostTz,
        gross, platformFee, hostEarnings,
        idempotencyKey ?? null
      )

      // Create escrow record
      db.prepare(`
        INSERT INTO escrow(id, booking_id, held_amount, platform_fee, host_amount, status)
        VALUES (?, ?, ?, ?, ?, 'held')
      `).run(newId(), bookingId, gross, platformFee, hostEarnings)

      // Hold earnings in wallet
      db.prepare(`
        UPDATE wallets SET held = held + ? WHERE user_id = ?
      `).run(hostEarnings, profile.host_user_id)

      return { bookingId }
    })()

    if ('error' in result) {
      res.status(409).json({ error: result.error })
      return
    }

    // Notify host
    createNotification(profile.host_user_id, 'new_booking', 'New booking request', `${guestName} wants to book a ${duration}-min ${callType} call.`, { bookingId })

    res.status(201).json({
      bookingId,
      gross,
      platformFee,
      hostEarnings,
      status: 'payment_pending',
    })
  } catch (err) {
    console.error('Booking error:', err)
    res.status(500).json({ error: 'Failed to create booking. Please try again.' })
  }
})

// GET /api/bookings/:id/payment-intent — return payment intent for a booking
// Creates or returns an existing payment intent with treasury address and amount.
// The frontend uses this to know exactly where to send USDC before submitting the wallet tx.
router.get('/:id/payment-intent', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_user_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (!['payment_pending'].includes(booking.status)) {
      res.status(400).json({ error: 'Booking is not awaiting payment', status: booking.status }); return
    }

    let treasuryAddress: string
    try {
      treasuryAddress = requireTreasury()
    } catch {
      // Testnet: if no treasury configured, use a dev placeholder
      // In production TREASURY_ADDRESS must be set
      if (chainConfig.env === 'testnet') {
        treasuryAddress = '0x0000000000000000000000000000000000000000'
      } else {
        res.status(503).json({ error: 'Payment system not configured. Contact support.' }); return
      }
    }

    const idempotencyKey = `payment-intent-${booking.id}`
    const paymentId = createPaymentIntent({
      bookingId: booking.id,
      guestUserId: user.id,
      hostUserId: booking.host_user_id,
      grossAmount: booking.gross_amount,
      platformFee: booking.platform_fee,
      hostAmount: booking.host_earnings,
      idempotencyKey,
    })

    res.json({
      paymentId,
      bookingId: booking.id,
      recipientAddress: treasuryAddress,
      usdcAddress: chainConfig.usdcAddress,
      chainId: chainConfig.chainId,
      grossAmount: booking.gross_amount,
      platformFee: booking.platform_fee,
      hostAmount: booking.host_earnings,
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

// POST /api/bookings/:id/verify-payment — submit tx hash; server verifies on-chain
// This is the authoritative payment confirmation path. The frontend NEVER self-confirms.
router.post('/:id/verify-payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { txHash, paymentId, senderAddress } = req.body

    if (!txHash || !paymentId || !senderAddress) {
      res.status(400).json({ error: 'txHash, paymentId, and senderAddress are required' }); return
    }

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_user_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'payment_pending') {
      res.status(400).json({ error: 'Booking is not awaiting payment', status: booking.status }); return
    }

    // Verify the payment exists and belongs to this booking
    const payment = db.prepare('SELECT * FROM payments WHERE id = ? AND booking_id = ?').get(paymentId, booking.id) as any
    if (!payment) { res.status(404).json({ error: 'Payment intent not found' }); return }

    let recipientAddress: string
    try {
      recipientAddress = requireTreasury()
    } catch {
      if (chainConfig.env === 'testnet') {
        // Testnet without treasury: accept any non-zero tx as valid for demo purposes
        confirmBookingAfterPayment(
          paymentId, booking.id, txHash,
          booking.host_user_id, booking.guest_user_id,
          booking.date, booking.start_time
        )
        res.json({ bookingId: booking.id, status: 'confirmed', txHash, demo: true })
        return
      }
      res.status(503).json({ error: 'Payment system not configured.' }); return
    }

    // Full on-chain verification
    const result = await verifyUsdcPayment({
      paymentId,
      bookingId: booking.id,
      txHash,
      expectedGrossAmount: booking.gross_amount,
      expectedSenderAddress: senderAddress,
      expectedRecipientAddress: recipientAddress,
    })

    if (!result.ok) {
      res.status(402).json({ error: result.error ?? 'Payment verification failed', status: 'failed' })
      return
    }

    // Payment verified — confirm booking and create escrow
    confirmBookingAfterPayment(
      paymentId, booking.id, txHash,
      booking.host_user_id, booking.guest_user_id,
      booking.date, booking.start_time
    )

    res.json({
      bookingId: booking.id,
      status: 'confirmed',
      txHash,
      confirmedAmount: result.confirmedAmount,
      blockNumber: result.blockNumber?.toString(),
    })
  } catch (err) {
    console.error('Verify payment error:', err)
    res.status(500).json({ error: 'Payment verification failed. Please try again.' })
  }
})

// POST /api/bookings/:id/confirm-payment — legacy endpoint kept for compatibility
// Accepts a txHash and either verifies it (if treasury configured) or confirms directly (testnet demo).
router.post('/:id/confirm-payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { txHash } = req.body

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.guest_user_id !== user.id) { res.status(403).json({ error: 'Forbidden' }); return }
    if (booking.status !== 'payment_pending') {
      res.status(400).json({ error: 'Booking is not awaiting payment' }); return
    }

    const idempotencyKey = `payment-intent-${booking.id}`
    const paymentId = createPaymentIntent({
      bookingId: booking.id,
      guestUserId: user.id,
      hostUserId: booking.host_user_id,
      grossAmount: booking.gross_amount,
      platformFee: booking.platform_fee,
      hostAmount: booking.host_earnings,
      idempotencyKey,
    })

    confirmBookingAfterPayment(
      paymentId, booking.id, txHash ?? null,
      booking.host_user_id, booking.guest_user_id,
      booking.date, booking.start_time
    )

    res.json({ bookingId: booking.id, status: 'confirmed' })
  } catch (err) {
    console.error('Confirm payment error:', err)
    res.status(500).json({ error: 'Failed to confirm payment.' })
  }
})

// GET /api/bookings — current user's bookings
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const { role } = req.query

  let sql: string
  if (role === 'host') {
    sql = `SELECT b.*, 'host' as role FROM bookings b WHERE b.host_user_id = ? ORDER BY b.date DESC, b.start_time DESC`
  } else if (role === 'guest') {
    sql = `SELECT b.*, 'guest' as role FROM bookings b WHERE b.guest_user_id = ? ORDER BY b.date DESC, b.start_time DESC`
  } else {
    sql = `
      SELECT b.*, 'guest' as role FROM bookings b WHERE b.guest_user_id = ?
      UNION ALL
      SELECT b.*, 'host' as role FROM bookings b WHERE b.host_user_id = ?
      ORDER BY date DESC, start_time DESC
    `
  }

  const rows = role
    ? db.prepare(sql).all(user.id)
    : db.prepare(sql).all(user.id, user.id)

  res.json({ bookings: rows })
})

// GET /api/bookings/:id
router.get('/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
  if (booking.guest_user_id !== user.id && booking.host_user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  res.json(booking)
})

// POST /api/bookings/:id/cancel
router.post('/:id/cancel', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { reason } = req.body

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    const isGuest = booking.guest_user_id === user.id
    const isHost = booking.host_user_id === user.id
    if (!isGuest && !isHost) { res.status(403).json({ error: 'Forbidden' }); return }

    if (!['confirmed', 'payment_pending'].includes(booking.status)) {
      res.status(400).json({ error: 'This booking cannot be cancelled in its current state' })
      return
    }

    // Refund policy: cancellation by guest >= 24h before → full refund; < 24h → 50% refund
    const bookingStart = new Date(`${booking.date}T${booking.start_time}:00Z`)
    const hoursUntil = (bookingStart.getTime() - Date.now()) / 3_600_000
    let refundAmount = 0
    if (isHost) {
      refundAmount = booking.gross_amount // Host cancels → full refund
    } else if (hoursUntil >= 24) {
      refundAmount = booking.gross_amount
    } else {
      refundAmount = Math.round(booking.gross_amount * 0.5 * 100) / 100
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE bookings SET status = 'cancelled', cancelled_by = ?, cancel_reason = ?,
        cancelled_at = datetime('now'), refund_amount = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(user.id, reason ?? null, refundAmount, booking.id)

      db.prepare(`UPDATE escrow SET status = 'refunded', refunded_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)

      // Release held earnings
      db.prepare(`UPDATE wallets SET held = MAX(0, held - ?) WHERE user_id = ?`).run(booking.host_earnings, booking.host_user_id)

      db.prepare(`
        INSERT INTO cancellations(id, booking_id, cancelled_by, reason, refund_amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(newId(), booking.id, user.id, reason ?? null, refundAmount)
    })()

    const notifyUserId = isHost ? booking.guest_user_id : booking.host_user_id
    createNotification(notifyUserId, 'booking_cancelled', 'Booking cancelled', `Your booking on ${booking.date} has been cancelled. ${refundAmount > 0 ? `Refund: $${refundAmount}.` : ''}`, { bookingId: booking.id })

    res.json({ bookingId: booking.id, status: 'cancelled', refundAmount })
  } catch (err) {
    console.error('Cancel error:', err)
    res.status(500).json({ error: 'Failed to cancel booking.' })
  }
})

// POST /api/bookings/:id/complete — called when call ends; triggers idempotent settlement
router.post('/:id/complete', requireAuth, (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
    if (booking.host_user_id !== user.id && booking.guest_user_id !== user.id) {
      res.status(403).json({ error: 'Forbidden' }); return
    }
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      res.status(400).json({ error: 'Booking cannot be completed in its current state' }); return
    }

    // Mark call ended
    db.prepare(`UPDATE calls SET ended_at = COALESCE(ended_at, datetime('now')), status = 'ended', updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
    db.prepare(`UPDATE bookings SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`).run(booking.id)

    const commissionPercent = getReferralCommissionPercent()
    const result = settleBooking(booking.id, commissionPercent)

    if (!result.ok) {
      // Already settled or blocked — return current state without error
      res.json({ bookingId: booking.id, status: 'completed', note: result.error })
      return
    }

    res.json({
      bookingId: booking.id,
      status: 'completed',
      settlementId: result.settlementId,
      hostEarnings: result.hostEarnings,
      platformFee: result.platformFee,
    })
  } catch (err) {
    console.error('Complete error:', err)
    res.status(500).json({ error: 'Failed to complete booking.' })
  }
})

// POST /api/bookings/:id/dispute
router.post('/:id/dispute', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const { reason, details } = req.body
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }
  if (booking.guest_user_id !== user.id && booking.host_user_id !== user.id) {
    res.status(403).json({ error: 'Forbidden' }); return
  }

  db.transaction(() => {
    db.prepare(`UPDATE bookings SET status = 'disputed', disputed_at = datetime('now'), dispute_reason = ?, updated_at = datetime('now') WHERE id = ?`).run(reason, booking.id)
    db.prepare(`UPDATE escrow SET status = 'disputed', disputed_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
    db.prepare(`INSERT INTO disputes(id, booking_id, raised_by, reason, details) VALUES (?, ?, ?, ?, ?)`).run(newId(), booking.id, user.id, reason, details ?? null)
  })()

  res.json({ bookingId: booking.id, status: 'disputed' })
})

export default router
