/**
 * server/call-sweeper.ts
 *
 * Runs once a minute on the server. It is the only thing that decides how a call went and
 * when held money is released. Nothing the host or the guest sends can trigger these steps.
 *
 *   1. Expire bookings that were never paid.
 *   2. Judge calls whose time is over, from the attendance recorded by the video service.
 *   3. Release the host's money once the dispute window has passed with no problem raised.
 *
 * Every state change claims its row first (UPDATE ... WHERE status = ... RETURNING), so each
 * booking is handled once even if two sweeps overlap or the server restarts mid-way.
 */

import db, { withTransaction } from './db'
import { newId } from './utils'
import { createNotification } from './notifications'
import { getReferralCommissionPercent } from './config'
import { settleBooking } from './payment-service'
import {
  evaluateCallOutcome,
  FINALIZE_AFTER_END_MS,
  HARD_STOP_AFTER_END_MS,
  DISPUTE_WINDOW_HOURS,
  UNPAID_EXPIRY_MINUTES,
  type CallOutcome,
  type Interval,
} from './call-outcome'

let sweeping = false

export function startCallSweeper(intervalMs = 60_000): () => void {
  const tick = async () => {
    if (sweeping) return
    sweeping = true
    try {
      await sweepOnce()
    } catch (err) {
      console.error('Call sweep failed:', err)
    } finally {
      sweeping = false
    }
  }
  const first = setTimeout(() => void tick(), 15_000)
  const timer = setInterval(() => void tick(), intervalMs)
  return () => { clearTimeout(first); clearInterval(timer) }
}

export async function sweepOnce(): Promise<void> {
  await expireUnpaidBookings()
  await finalizeOverdueCalls()
  await releaseDueEscrow()
}

// ─── 1. Unpaid bookings ───────────────────────────────────────────────────────
async function expireUnpaidBookings(): Promise<void> {
  // A booking with a payment transaction attached is left alone for a person to check,
  // so money that was sent is never silently expired.
  const expired = await db.all(
    `UPDATE bookings SET status='expired', updated_at=NOW()
     WHERE status='payment_pending'
       AND created_at < NOW() - ($1 * interval '1 minute')
       AND NOT EXISTS (
         SELECT 1 FROM payments p
         WHERE p.booking_id = bookings.id AND p.tx_hash IS NOT NULL AND p.tx_hash <> ''
       )
     RETURNING id`,
    [UNPAID_EXPIRY_MINUTES],
  )
  if (expired.length === 0) return
  const ids = expired.map((r) => String(r.id))
  await db.run(`UPDATE escrow SET status='cancelled', updated_at=NOW() WHERE booking_id = ANY($1::text[]) AND status='held'`, [ids])
  await db.run(
    `UPDATE payments SET status='expired', updated_at=NOW()
     WHERE booking_id = ANY($1::text[]) AND status IN ('created','awaiting_payment')`,
    [ids],
  )
}

// ─── 2. Judge calls that are over ─────────────────────────────────────────────
async function finalizeOverdueCalls(): Promise<void> {
  const due = await db.all(
    `SELECT * FROM bookings b
     WHERE b.status='confirmed'
       AND ((b.date || 'T' || b.start_time || ':00Z')::timestamptz
            + (b.duration_mins * interval '1 minute')
            + ($1 * interval '1 millisecond')) < NOW()
     ORDER BY b.date, b.start_time
     LIMIT 50`,
    [FINALIZE_AFTER_END_MS],
  )
  for (const booking of due) {
    try {
      await finalizeBooking(booking)
    } catch (err) {
      console.error('Failed to finalise booking', booking.id, err)
    }
  }
}

async function finalizeBooking(booking: Record<string, any>): Promise<void> {
  const startMs = new Date(`${booking.date}T${booking.start_time}:00Z`).getTime()
  const durationMins = Number(booking.duration_mins)
  const hardStopMs = startMs + durationMins * 60_000 + HARD_STOP_AFTER_END_MS

  const sessions = await db.all('SELECT role, joined_at, left_at FROM call_sessions WHERE booking_id=$1', [booking.id])
  const call = await db.get('SELECT host_token_at, guest_token_at FROM calls WHERE booking_id=$1', [booking.id])

  const host: Interval[] = []
  const guest: Interval[] = []
  for (const s of sessions) {
    const joined = new Date(s.joined_at as string).getTime()
    // A session with no recorded leave is treated as lasting until everyone is removed.
    const left = s.left_at ? new Date(s.left_at as string).getTime() : hardStopMs
    const interval = { startMs: joined, endMs: left }
    if (s.role === 'host') host.push(interval)
    else if (s.role === 'guest') guest.push(interval)
  }

  const { outcome, overlapMs, hostMs, guestMs } = evaluateCallOutcome({
    startMs,
    durationMins,
    host,
    guest,
    hostTokenIssued: Boolean(call?.host_token_at),
    guestTokenIssued: Boolean(call?.guest_token_at),
  })

  const applied = await withTransaction(async (tx) => {
    let claim: Record<string, any> | undefined

    if (outcome === 'completed' || outcome === 'guest_no_show') {
      // The host is paid, after the dispute window.
      claim = await tx.get(
        `UPDATE bookings SET status='completed', outcome=$2, release_at = NOW() + ($3 * interval '1 hour'), updated_at=NOW()
         WHERE id=$1 AND status='confirmed' RETURNING id`,
        [booking.id, outcome, DISPUTE_WINDOW_HOURS],
      )
    } else if (outcome === 'host_no_show' || outcome === 'both_no_show') {
      // The guest is owed a full refund. The host earns nothing.
      claim = await tx.get(
        `UPDATE bookings SET status='cancelled', outcome=$2, cancel_reason=$2, cancelled_at=NOW(), updated_at=NOW()
         WHERE id=$1 AND status='confirmed' RETURNING id`,
        [booking.id, outcome],
      )
      if (claim) {
        await tx.run(`UPDATE escrow SET status='refund_pending', updated_at=NOW() WHERE booking_id=$1 AND status='escrowed'`, [booking.id])
        await tx.run(`UPDATE wallets SET held=GREATEST(0,held-$1) WHERE user_id=$2`, [booking.host_amount, booking.host_id])
        await tx.run(
          `INSERT INTO refunds(id,booking_id,user_id,amount,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT (booking_id) DO NOTHING`,
          [newId(), booking.id, booking.guest_id, Number(booking.booking_amount), outcome],
        )
      }
    } else {
      // Unclear: keep the money held and put it in front of a person.
      claim = await tx.get(
        `UPDATE bookings SET status='disputed', outcome='needs_review', updated_at=NOW()
         WHERE id=$1 AND status='confirmed' RETURNING id`,
        [booking.id],
      )
      if (claim) {
        await tx.run(`UPDATE escrow SET status='disputed', updated_at=NOW() WHERE booking_id=$1 AND status='escrowed'`, [booking.id])
        await tx.run(
          `INSERT INTO disputes(id,booking_id,opened_by,reason,evidence) VALUES($1,$2,$3,$4,$5)`,
          [
            newId(), booking.id, booking.guest_id,
            'Automatic review: call attendance was unclear',
            `Opened automatically by Dimely. Host present ${Math.round(hostMs / 1000)}s, guest present ${Math.round(guestMs / 1000)}s, together ${Math.round(overlapMs / 1000)}s.`,
          ],
        )
      }
    }

    if (!claim) return false
    await tx.run(`UPDATE calls SET outcome=$2, finalized_at=NOW(), status='ended' WHERE booking_id=$1`, [booking.id, outcome])
    return true
  })

  if (applied) notifyOutcome(outcome, booking)
}

function notifyOutcome(outcome: CallOutcome, b: Record<string, any>): void {
  const meta = { bookingId: b.id }
  const hostId = String(b.host_id)
  const guestId = String(b.guest_id)
  switch (outcome) {
    case 'completed':
      createNotification(hostId, 'call_completed', 'Call complete',
        `Your call on ${b.date} is complete. Your earnings are released after ${DISPUTE_WINDOW_HOURS} hours unless a problem is raised.`, meta)
      createNotification(guestId, 'call_completed', 'Call complete',
        `Your call on ${b.date} is complete. If something went wrong, you can raise a problem within ${DISPUTE_WINDOW_HOURS} hours.`, meta)
      break
    case 'guest_no_show':
      createNotification(hostId, 'call_completed', 'Your guest did not join',
        `Your guest did not join the call on ${b.date}. Your earnings are released after ${DISPUTE_WINDOW_HOURS} hours.`, meta)
      createNotification(guestId, 'call_missed', 'You missed your call',
        `You did not join your call on ${b.date}. Missed calls are not refunded.`, meta)
      break
    case 'host_no_show':
      createNotification(guestId, 'refund_pending', 'Your host did not join',
        `Your host did not join the call on ${b.date}. You will be refunded in full.`, meta)
      createNotification(hostId, 'call_missed', 'You missed a call',
        `You did not join the call on ${b.date}. The guest is being refunded.`, meta)
      break
    case 'both_no_show':
      createNotification(guestId, 'refund_pending', 'Your call did not take place',
        `Nobody joined the call on ${b.date}. You will be refunded in full.`, meta)
      createNotification(hostId, 'call_missed', 'Your call did not take place',
        `Nobody joined the call on ${b.date}. The guest is being refunded.`, meta)
      break
    case 'needs_review':
      createNotification(guestId, 'call_review', 'We are reviewing your call',
        'We could not confirm how this call went. Your payment stays safely held while we review it.', meta)
      createNotification(hostId, 'call_review', 'We are reviewing your call',
        'We could not confirm how this call went. The payment stays held while we review it.', meta)
      break
  }
}

// ─── 3. Release held money after the dispute window ───────────────────────────
async function releaseDueEscrow(): Promise<void> {
  const due = await db.all(
    `SELECT id FROM bookings
     WHERE status='completed'
       AND outcome IN ('completed','guest_no_show')
       AND release_at IS NOT NULL AND release_at <= NOW()
     ORDER BY release_at
     LIMIT 50`,
  )
  const commissionPercent = getReferralCommissionPercent()
  for (const row of due) {
    const result = await settleBooking(String(row.id), commissionPercent)
    if (!result.ok && result.error === 'Settlement failed.') {
      console.error('Release failed for booking', row.id)
    }
  }
}
