/**
 * server/routes/admin.ts
 *
 * Admin dashboard API endpoints. All routes require admin role enforced server-side.
 * Never expose this router to unauthenticated or non-admin users.
 */
import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAdmin } from '../auth'
import { newId } from '../utils'
import { reverseReferralCommission } from '../payment-service'

const router = Router()

// ─── Overview stats ──────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, (_req: Request, res: Response) => {
  const users = db.prepare(`SELECT COUNT(*) as total FROM users`).get() as any
  const newUsers = db.prepare(`SELECT COUNT(*) as c FROM users WHERE created_at >= date('now', '-30 days')`).get() as any
  const hosts = db.prepare(`SELECT COUNT(*) as c FROM profiles WHERE published = 1`).get() as any
  const profiles = db.prepare(`SELECT COUNT(*) as c FROM profiles`).get() as any
  const published = db.prepare(`SELECT COUNT(*) as c FROM profiles WHERE published = 1`).get() as any

  const bookings = db.prepare(`SELECT COUNT(*) as c FROM bookings`).get() as any
  const completed = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'completed'`).get() as any
  const cancelled = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'`).get() as any
  const disputed = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE status = 'disputed'`).get() as any
  const inEscrow = db.prepare(`SELECT COUNT(*) as c FROM escrow WHERE status IN ('held','escrowed')`).get() as any

  const financial = db.prepare(`
    SELECT
      COALESCE(SUM(gross_amount), 0) as gross_volume,
      COALESCE(SUM(platform_fee), 0) as platform_revenue,
      COALESCE(SUM(host_earnings), 0) as host_earnings
    FROM bookings WHERE status = 'completed'
  `).get() as any

  const heldEscrow = db.prepare(`SELECT COALESCE(SUM(held_amount), 0) as total FROM escrow WHERE status IN ('held','escrowed')`).get() as any
  const refunds = db.prepare(`SELECT COALESCE(SUM(gross_amount), 0) as total FROM bookings WHERE status = 'cancelled' AND refund_amount > 0`).get() as any
  const withdrawals = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM withdrawals WHERE status = 'completed'`).get() as any

  const referrals = db.prepare(`SELECT COUNT(*) as total FROM referral_relationships`).get() as any
  const activeRef = db.prepare(`SELECT COUNT(*) as c FROM referral_relationships WHERE status = 'active'`).get() as any
  const refCommissions = db.prepare(`SELECT COALESCE(SUM(commission_amount),0) as total FROM referral_commissions WHERE status IN ('eligible','paid')`).get() as any

  const aiAgents = db.prepare(`SELECT COUNT(*) as c FROM ai_agents WHERE is_enabled = 1`).get() as any
  const agentActivity = db.prepare(`SELECT COUNT(*) as c FROM agent_activity WHERE created_at >= date('now', '-30 days')`).get() as any

  res.json({
    users: {
      total: users.total,
      newThisMonth: newUsers.c,
      hosts: hosts.c,
    },
    marketplace: {
      totalProfiles: profiles.c,
      publishedProfiles: published.c,
      totalBookings: bookings.c,
      completedBookings: completed.c,
      cancelledBookings: cancelled.c,
      disputedBookings: disputed.c,
      inEscrowCount: inEscrow.c,
    },
    financial: {
      grossVolume: financial.gross_volume,
      platformRevenue: financial.platform_revenue,
      hostEarnings: financial.host_earnings,
      heldEscrow: heldEscrow.total,
      totalRefunds: refunds.total,
      withdrawalsTotal: withdrawals.total,
      withdrawalsCount: withdrawals.count,
    },
    growth: {
      totalReferrals: referrals.total,
      activeReferrals: activeRef.c,
      referralCommissions: refCommissions.total,
    },
    ai: {
      activeAgents: aiAgents.c,
      activityThisMonth: agentActivity.c,
    },
  })
})

// ─── Users ───────────────────────────────────────────────────────────────────
router.get('/users', requireAdmin, (req: Request, res: Response) => {
  const { q, limit = '50', offset = '0' } = req.query
  let sql = `
    SELECT u.id, u.email, u.name, u.username, u.role, u.created_at,
           p.headline, p.published, p.booking_count, p.verified,
           w.available, w.held, w.total_earned
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
  `
  const params: unknown[] = []
  if (q) {
    sql += ` WHERE u.name LIKE ? OR u.email LIKE ? OR u.username LIKE ?`
    const like = `%${q}%`
    params.push(like, like, like)
  }
  sql += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))

  const rows = db.prepare(sql).all(...params)
  const total = db.prepare(`SELECT COUNT(*) as c FROM users${q ? ` WHERE name LIKE ? OR email LIKE ? OR username LIKE ?` : ''}`).get(...(q ? [`%${q}%`, `%${q}%`, `%${q}%`] : [])) as any
  res.json({ users: rows, total: total.c })
})

router.get('/users/:id', requireAdmin, (req: Request, res: Response) => {
  const user = db.prepare(`
    SELECT u.*, p.id as profile_id, p.headline, p.bio, p.category, p.price_per_min,
           p.booking_count, p.verified, p.published, p.avatar_color, p.avatar_initials,
           w.available, w.held, w.total_earned
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN wallets w ON w.user_id = u.id
    WHERE u.id = ?
  `).get(req.params.id) as any
  if (!user) { res.status(404).json({ error: 'User not found' }); return }

  const bookings = db.prepare(`SELECT COUNT(*) as c FROM bookings WHERE guest_user_id = ? OR host_user_id = ?`).get(user.id, user.id) as any
  const transactions = db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`).all(user.id)
  const disputes = db.prepare(`
    SELECT d.* FROM disputes d
    JOIN bookings b ON b.id = d.booking_id
    WHERE b.guest_user_id = ? OR b.host_user_id = ?
    ORDER BY d.created_at DESC
  `).all(user.id, user.id)

  res.json({ user, bookingCount: bookings.c, recentTransactions: transactions, disputes })
})

router.post('/users/:id/suspend', requireAdmin, (req: Request, res: Response) => {
  const { reason } = req.body
  db.prepare(`UPDATE users SET role = 'suspended', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  // Audit log
  db.prepare(`INSERT INTO transactions(id, user_id, type, amount, note) VALUES (?, ?, 'admin_action', 0, ?)`).run(
    newId(), req.params.id, `Account suspended: ${reason ?? 'No reason provided'}`
  )
  res.json({ ok: true, status: 'suspended' })
})

router.post('/users/:id/restore', requireAdmin, (req: Request, res: Response) => {
  db.prepare(`UPDATE users SET role = 'user', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  db.prepare(`INSERT INTO transactions(id, user_id, type, amount, note) VALUES (?, ?, 'admin_action', 0, 'Account restored')`).run(newId(), req.params.id)
  res.json({ ok: true, status: 'active' })
})

router.post('/users/:id/verify', requireAdmin, (req: Request, res: Response) => {
  db.prepare(`UPDATE profiles SET verified = 1, updated_at = datetime('now') WHERE user_id = ?`).run(req.params.id)
  db.prepare(`INSERT INTO transactions(id, user_id, type, amount, note) VALUES (?, ?, 'admin_action', 0, 'Profile verified by admin')`).run(newId(), req.params.id)
  res.json({ ok: true })
})

// ─── Bookings ────────────────────────────────────────────────────────────────
router.get('/bookings', requireAdmin, (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query
  let sql = `
    SELECT b.*,
           gu.name as guest_name_resolved, gu.email as guest_email_resolved,
           hu.name as host_name_resolved,
           e.status as escrow_status, e.held_amount,
           p.status as payment_status, p.tx_hash, p.confirmed_amount
    FROM bookings b
    LEFT JOIN users gu ON gu.id = b.guest_user_id
    LEFT JOIN users hu ON hu.id = b.host_user_id
    LEFT JOIN escrow e ON e.booking_id = b.id
    LEFT JOIN payments p ON p.id = b.payment_id
  `
  const params: unknown[] = []
  if (status) {
    sql += ` WHERE b.status = ?`
    params.push(status)
  }
  sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))
  const rows = db.prepare(sql).all(...params)
  res.json({ bookings: rows })
})

router.get('/bookings/:id', requireAdmin, (req: Request, res: Response) => {
  const booking = db.prepare(`
    SELECT b.*,
           gu.name as guest_name_resolved, gu.email as guest_email_resolved,
           hu.name as host_name_resolved,
           e.status as escrow_status, e.held_amount, e.released_at, e.refunded_at,
           p.status as payment_status, p.tx_hash, p.confirmed_amount, p.block_number
    FROM bookings b
    LEFT JOIN users gu ON gu.id = b.guest_user_id
    LEFT JOIN users hu ON hu.id = b.host_user_id
    LEFT JOIN escrow e ON e.booking_id = b.id
    LEFT JOIN payments p ON p.id = b.payment_id
    WHERE b.id = ?
  `).get(req.params.id) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

  const callRecord = db.prepare('SELECT * FROM calls WHERE booking_id = ?').get(booking.id)
  const dispute = db.prepare('SELECT * FROM disputes WHERE booking_id = ?').get(booking.id)
  const transactions = db.prepare('SELECT * FROM transactions WHERE booking_id = ? ORDER BY created_at ASC').all(booking.id)

  res.json({ booking, call: callRecord, dispute, transactions })
})

// ─── Payments ────────────────────────────────────────────────────────────────
router.get('/payments', requireAdmin, (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query
  let sql = `
    SELECT p.*,
           pu.name as payer_name, pu.email as payer_email,
           hu.name as host_name,
           b.date, b.duration, b.gross_amount, b.platform_fee, b.host_earnings,
           b.status as booking_status,
           e.status as escrow_status
    FROM payments p
    LEFT JOIN users pu ON pu.id = p.payer_user_id
    LEFT JOIN bookings b ON b.id = p.booking_id
    LEFT JOIN users hu ON hu.id = b.host_user_id
    LEFT JOIN escrow e ON e.booking_id = p.booking_id
  `
  const params: unknown[] = []
  if (status) { sql += ` WHERE p.status = ?`; params.push(status) }
  sql += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))
  res.json({ payments: db.prepare(sql).all(...params) })
})

// ─── Disputes ────────────────────────────────────────────────────────────────
router.get('/disputes', requireAdmin, (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query
  let sql = `
    SELECT d.*,
           b.date, b.duration, b.gross_amount, b.status as booking_status,
           gu.name as guest_name, hu.name as host_name,
           rb.name as raised_by_name
    FROM disputes d
    JOIN bookings b ON b.id = d.booking_id
    JOIN users gu ON gu.id = b.guest_user_id
    JOIN users hu ON hu.id = b.host_user_id
    JOIN users rb ON rb.id = d.raised_by
  `
  const params: unknown[] = []
  if (status) { sql += ` WHERE d.status = ?`; params.push(status) }
  sql += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))
  res.json({ disputes: db.prepare(sql).all(...params) })
})

router.post('/disputes/:id/resolve', requireAdmin, (req: Request, res: Response) => {
  const admin = (req as any).user
  const { resolution, refundGuest, releaseToHost, note } = req.body

  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id) as any
  if (!dispute) { res.status(404).json({ error: 'Dispute not found' }); return }

  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(dispute.booking_id) as any
  if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

  db.transaction(() => {
    db.prepare(`
      UPDATE disputes SET status = ?, resolved_by = ?, resolution_note = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(resolution ?? 'resolved', admin.id, note ?? null, dispute.id)

    if (refundGuest) {
      db.prepare(`UPDATE bookings SET status = 'refunded', refunded_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(booking.id)
      db.prepare(`UPDATE escrow SET status = 'refunded', refunded_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
      // Release held amount from host wallet
      db.prepare(`UPDATE wallets SET held = MAX(0, held - ?) WHERE user_id = ?`).run(booking.host_earnings, booking.host_user_id)
      // Reverse referral commission
      reverseReferralCommission(booking.id, `Admin dispute resolution: ${note ?? 'refund to guest'}`)
      // Ledger
      db.prepare(`INSERT INTO transactions(id, user_id, type, amount, booking_id, note) VALUES (?, ?, 'refund', ?, ?, ?)`).run(
        newId(), booking.guest_user_id, booking.gross_amount, booking.id, `Admin dispute refund: ${note ?? ''}`
      )
    } else if (releaseToHost) {
      db.prepare(`UPDATE bookings SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(booking.id)
      db.prepare(`UPDATE escrow SET status = 'released', released_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(booking.id)
      db.prepare(`UPDATE wallets SET held = MAX(0, held - ?), available = available + ?, total_earned = total_earned + ? WHERE user_id = ?`).run(
        booking.host_earnings, booking.host_earnings, booking.host_earnings, booking.host_user_id
      )
      db.prepare(`INSERT INTO transactions(id, user_id, type, amount, booking_id, note) VALUES (?, ?, 'settlement', ?, ?, ?)`).run(
        newId(), booking.host_user_id, booking.host_earnings, booking.id, `Admin dispute release to host: ${note ?? ''}`
      )
    }
  })()

  res.json({ ok: true, disputeId: dispute.id, resolution: resolution ?? 'resolved' })
})

// ─── Platform config ─────────────────────────────────────────────────────────
router.get('/config', requireAdmin, (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM platform_config').all() as any[]
  const config: Record<string, string> = {}
  for (const row of rows) config[row.key] = row.value
  res.json({ config })
})

router.patch('/config', requireAdmin, (req: Request, res: Response) => {
  const allowed = ['platform_fee_percent', 'referral_commission_percent', 'referral_duration_months', 'invite_only']
  for (const [key, value] of Object.entries(req.body)) {
    if (!allowed.includes(key)) continue
    db.prepare(`INSERT OR REPLACE INTO platform_config(key, value, updated_at) VALUES (?, ?, datetime('now'))`).run(key, String(value))
  }
  res.json({ ok: true })
})

// ─── Withdrawals queue ────────────────────────────────────────────────────────
router.get('/withdrawals', requireAdmin, (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query
  let sql = `
    SELECT w.*, u.name as user_name, u.email
    FROM withdrawals w JOIN users u ON u.id = w.user_id
  `
  const params: unknown[] = []
  if (status) { sql += ` WHERE w.status = ?`; params.push(status) }
  sql += ` ORDER BY w.created_at DESC LIMIT ? OFFSET ?`
  params.push(parseInt(limit as string, 10), parseInt(offset as string, 10))
  res.json({ withdrawals: db.prepare(sql).all(...params) })
})

export default router
