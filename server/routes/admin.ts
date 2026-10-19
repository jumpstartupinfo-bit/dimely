import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAdmin } from '../auth'
import { newId } from '../utils'
import { reverseReferralCommission } from '../payment-service'

const router = Router()

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await db.get(`SELECT COUNT(*) as total FROM users`)
    const newUsers = await db.get(`SELECT COUNT(*) as c FROM users WHERE created_at >= NOW() - INTERVAL '30 days'`)
    const hosts = await db.get(`SELECT COUNT(*) as c FROM profiles WHERE published = true`)
    const profiles = await db.get(`SELECT COUNT(*) as c FROM profiles`)
    const bookings = await db.get(`SELECT COUNT(*) as c FROM bookings`)
    const completed = await db.get(`SELECT COUNT(*) as c FROM bookings WHERE status = 'completed'`)
    const cancelled = await db.get(`SELECT COUNT(*) as c FROM bookings WHERE status = 'cancelled'`)
    const disputed = await db.get(`SELECT COUNT(*) as c FROM bookings WHERE status = 'disputed'`)
    const inEscrow = await db.get(`SELECT COUNT(*) as c FROM escrow WHERE status IN ('held','escrowed')`)

    const financial = await db.get(`
      SELECT
        COALESCE(SUM(booking_amount), 0) as gross_volume,
        COALESCE(SUM(platform_fee), 0) as platform_revenue,
        COALESCE(SUM(host_amount), 0) as host_earnings
      FROM bookings WHERE status = 'completed'
    `)
    const heldEscrow = await db.get(`SELECT COALESCE(SUM(held_amount), 0) as total FROM escrow WHERE status IN ('held','escrowed')`)
    const withdrawals = await db.get(`SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count FROM withdrawals WHERE status = 'completed'`)
    const referrals = await db.get(`SELECT COUNT(*) as total FROM referral_relationships`)
    const activeRef = await db.get(`SELECT COUNT(*) as c FROM referral_relationships WHERE status = 'active'`)
    const refCommissions = await db.get(`SELECT COALESCE(SUM(commission_amount),0) as total FROM referral_commissions WHERE status IN ('eligible','paid')`)

    res.json({
      users: { total: parseInt(users?.total ?? 0), newThisMonth: parseInt(newUsers?.c ?? 0), hosts: parseInt(hosts?.c ?? 0) },
      marketplace: {
        totalProfiles: parseInt(profiles?.c ?? 0), publishedProfiles: parseInt(hosts?.c ?? 0),
        totalBookings: parseInt(bookings?.c ?? 0), completedBookings: parseInt(completed?.c ?? 0),
        cancelledBookings: parseInt(cancelled?.c ?? 0), disputedBookings: parseInt(disputed?.c ?? 0),
        inEscrowCount: parseInt(inEscrow?.c ?? 0),
      },
      financial: {
        grossVolume: parseFloat(financial?.gross_volume ?? 0),
        platformRevenue: parseFloat(financial?.platform_revenue ?? 0),
        hostEarnings: parseFloat(financial?.host_earnings ?? 0),
        heldEscrow: parseFloat(heldEscrow?.total ?? 0),
        withdrawalsTotal: parseFloat(withdrawals?.total ?? 0),
        withdrawalsCount: parseInt(withdrawals?.count ?? 0),
      },
      growth: {
        totalReferrals: parseInt(referrals?.total ?? 0),
        activeReferrals: parseInt(activeRef?.c ?? 0),
        referralCommissions: parseFloat(refCommissions?.total ?? 0),
      },
    })
  } catch (err) {
    console.error('Admin stats error:', err)
    res.status(500).json({ error: 'Failed to fetch stats.' })
  }
})

// GET /api/admin/users
router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { q, limit = '50', offset = '0' } = req.query
    const lim = parseInt(limit as string, 10)
    const off = parseInt(offset as string, 10)

    let rows: any[]
    let total: any
    if (q) {
      const like = `%${q}%`
      rows = await db.all(`
        SELECT u.id, u.email, u.name, u.username, u.role, u.created_at,
               p.headline, p.published, p.booking_count, p.verified,
               w.available, w.held, w.total_earned
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.name ILIKE $1 OR u.email ILIKE $1 OR u.username ILIKE $1
        ORDER BY u.created_at DESC LIMIT $2 OFFSET $3
      `, [like, lim, off])
      total = await db.get(`SELECT COUNT(*) as c FROM users WHERE name ILIKE $1 OR email ILIKE $1 OR username ILIKE $1`, [like])
    } else {
      rows = await db.all(`
        SELECT u.id, u.email, u.name, u.username, u.role, u.created_at,
               p.headline, p.published, p.booking_count, p.verified,
               w.available, w.held, w.total_earned
        FROM users u
        LEFT JOIN profiles p ON p.user_id = u.id
        LEFT JOIN wallets w ON w.user_id = u.id
        ORDER BY u.created_at DESC LIMIT $1 OFFSET $2
      `, [lim, off])
      total = await db.get(`SELECT COUNT(*) as c FROM users`)
    }
    res.json({ users: rows, total: parseInt(total?.c ?? 0) })
  } catch (err) {
    console.error('Admin users error:', err)
    res.status(500).json({ error: 'Failed to fetch users.' })
  }
})

router.get('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await db.get(`
      SELECT u.*, p.id as profile_id, p.headline, p.bio, p.category, p.price_per_min,
             p.booking_count, p.verified, p.published, p.avatar_color, p.avatar_initials,
             w.available, w.held, w.total_earned
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      LEFT JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1
    `, [req.params.id])
    if (!user) { res.status(404).json({ error: 'User not found' }); return }

    const bookingCount = await db.get(`SELECT COUNT(*) as c FROM bookings WHERE guest_id = $1 OR host_id = $1`, [user.id])
    const transactions = await db.all(`SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`, [user.id])

    res.json({ user, bookingCount: parseInt(bookingCount?.c ?? 0), recentTransactions: transactions })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user.' })
  }
})

router.post('/users/:id/suspend', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { reason } = req.body
    await db.run(`UPDATE users SET role = 'suspended', updated_at = NOW() WHERE id = $1`, [req.params.id])
    await db.run(`INSERT INTO transactions(id,user_id,type,amount,note) VALUES($1,$2,'admin_action',0,$3)`,
      [newId(), req.params.id, `Account suspended: ${reason ?? 'No reason provided'}`])
    res.json({ ok: true, status: 'suspended' })
  } catch (err) { res.status(500).json({ error: 'Failed to suspend user.' }) }
})

router.post('/users/:id/restore', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.run(`UPDATE users SET role = 'user', updated_at = NOW() WHERE id = $1`, [req.params.id])
    await db.run(`INSERT INTO transactions(id,user_id,type,amount,note) VALUES($1,$2,'admin_action',0,'Account restored')`,
      [newId(), req.params.id])
    res.json({ ok: true, status: 'active' })
  } catch (err) { res.status(500).json({ error: 'Failed to restore user.' }) }
})

router.post('/users/:id/verify', requireAdmin, async (req: Request, res: Response) => {
  try {
    await db.run(`UPDATE profiles SET verified = true, updated_at = NOW() WHERE user_id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: 'Failed to verify profile.' }) }
})

// GET /api/admin/bookings
router.get('/bookings', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query
    const lim = parseInt(limit as string, 10)
    const off = parseInt(offset as string, 10)
    let rows: any[]
    if (status) {
      rows = await db.all(`
        SELECT b.*, gu.name as guest_name_resolved, hu.name as host_name_resolved,
               e.status as escrow_status, e.held_amount
        FROM bookings b
        LEFT JOIN users gu ON gu.id = b.guest_id
        LEFT JOIN users hu ON hu.id = b.host_id
        LEFT JOIN escrow e ON e.booking_id = b.id
        WHERE b.status = $1
        ORDER BY b.created_at DESC LIMIT $2 OFFSET $3
      `, [status, lim, off])
    } else {
      rows = await db.all(`
        SELECT b.*, gu.name as guest_name_resolved, hu.name as host_name_resolved,
               e.status as escrow_status, e.held_amount
        FROM bookings b
        LEFT JOIN users gu ON gu.id = b.guest_id
        LEFT JOIN users hu ON hu.id = b.host_id
        LEFT JOIN escrow e ON e.booking_id = b.id
        ORDER BY b.created_at DESC LIMIT $1 OFFSET $2
      `, [lim, off])
    }
    res.json({ bookings: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bookings.' })
  }
})

// GET /api/admin/payments
router.get('/payments', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query
    const lim = parseInt(limit as string, 10)
    const off = parseInt(offset as string, 10)
    let rows: any[]
    if (status) {
      rows = await db.all(`
        SELECT p.*, pu.name as payer_name, b.date, b.booking_amount, b.platform_fee, b.host_amount, b.status as booking_status
        FROM payments p
        LEFT JOIN users pu ON pu.id = p.payer_user_id
        LEFT JOIN bookings b ON b.id = p.booking_id
        WHERE p.status = $1
        ORDER BY p.created_at DESC LIMIT $2 OFFSET $3
      `, [status, lim, off])
    } else {
      rows = await db.all(`
        SELECT p.*, pu.name as payer_name, b.date, b.booking_amount, b.platform_fee, b.host_amount, b.status as booking_status
        FROM payments p
        LEFT JOIN users pu ON pu.id = p.payer_user_id
        LEFT JOIN bookings b ON b.id = p.booking_id
        ORDER BY p.created_at DESC LIMIT $1 OFFSET $2
      `, [lim, off])
    }
    res.json({ payments: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments.' })
  }
})

// GET /api/admin/disputes
router.get('/disputes', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query
    const lim = parseInt(limit as string, 10)
    const off = parseInt(offset as string, 10)
    let rows: any[]
    if (status) {
      rows = await db.all(`
        SELECT d.*, b.date, b.booking_amount, b.status as booking_status,
               gu.name as guest_name, hu.name as host_name
        FROM disputes d
        JOIN bookings b ON b.id = d.booking_id
        JOIN users gu ON gu.id = b.guest_id
        JOIN users hu ON hu.id = b.host_id
        WHERE d.status = $1
        ORDER BY d.created_at DESC LIMIT $2 OFFSET $3
      `, [status, lim, off])
    } else {
      rows = await db.all(`
        SELECT d.*, b.date, b.booking_amount, b.status as booking_status,
               gu.name as guest_name, hu.name as host_name
        FROM disputes d
        JOIN bookings b ON b.id = d.booking_id
        JOIN users gu ON gu.id = b.guest_id
        JOIN users hu ON hu.id = b.host_id
        ORDER BY d.created_at DESC LIMIT $1 OFFSET $2
      `, [lim, off])
    }
    res.json({ disputes: rows })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch disputes.' })
  }
})

router.post('/disputes/:id/resolve', requireAdmin, async (req: Request, res: Response) => {
  try {
    const admin = (req as any).user
    const { resolution, refundGuest, releaseToHost, note } = req.body

    const dispute = await db.get('SELECT * FROM disputes WHERE id = $1', [req.params.id])
    if (!dispute) { res.status(404).json({ error: 'Dispute not found' }); return }
    const booking = await db.get('SELECT * FROM bookings WHERE id = $1', [dispute.booking_id])
    if (!booking) { res.status(404).json({ error: 'Booking not found' }); return }

    await db.run(`UPDATE disputes SET status=$1, resolved_by=$2, resolution_note=$3, updated_at=NOW() WHERE id=$4`,
      [resolution ?? 'resolved', admin.id, note ?? null, dispute.id])

    if (refundGuest) {
      await db.run(`UPDATE bookings SET status='refunded', updated_at=NOW() WHERE id=$1`, [booking.id])
      await db.run(`UPDATE escrow SET status='refunded', updated_at=NOW() WHERE booking_id=$1`, [booking.id])
      await db.run(`UPDATE wallets SET held=GREATEST(0,held-$1) WHERE user_id=$2`, [booking.host_amount, booking.host_id])
      reverseReferralCommission(booking.id, `Admin dispute resolution: ${note ?? 'refund to guest'}`)
    } else if (releaseToHost) {
      await db.run(`UPDATE bookings SET status='completed', updated_at=NOW() WHERE id=$1`, [booking.id])
      await db.run(`UPDATE escrow SET status='released', updated_at=NOW() WHERE booking_id=$1`, [booking.id])
      await db.run(`UPDATE wallets SET held=GREATEST(0,held-$1), available=available+$1, total_earned=total_earned+$1 WHERE user_id=$2`,
        [booking.host_amount, booking.host_id])
    }

    res.json({ ok: true, disputeId: dispute.id, resolution: resolution ?? 'resolved' })
  } catch (err) {
    console.error('Resolve dispute error:', err)
    res.status(500).json({ error: 'Failed to resolve dispute.' })
  }
})

// GET /api/admin/config
router.get('/config', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.all('SELECT key, value FROM platform_config')
    const config: Record<string, string> = {}
    for (const row of rows) config[row.key] = row.value
    res.json({ config })
  } catch (err) { res.status(500).json({ error: 'Failed to fetch config.' }) }
})

router.patch('/config', requireAdmin, async (req: Request, res: Response) => {
  try {
    const allowed = ['platform_fee_percent', 'referral_commission_percent', 'referral_duration_months', 'invite_only']
    for (const [key, value] of Object.entries(req.body)) {
      if (!allowed.includes(key)) continue
      await db.run(`INSERT INTO platform_config(key,value,updated_at) VALUES($1,$2,NOW())
        ON CONFLICT(key) DO UPDATE SET value=$2, updated_at=NOW()`, [key, String(value)])
    }
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: 'Failed to update config.' }) }
})

// GET /api/admin/withdrawals
router.get('/withdrawals', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query
    const lim = parseInt(limit as string, 10)
    const off = parseInt(offset as string, 10)
    let rows: any[]
    if (status) {
      rows = await db.all(`SELECT w.*, u.name as user_name, u.email FROM withdrawals w JOIN users u ON u.id=w.user_id WHERE w.status=$1 ORDER BY w.created_at DESC LIMIT $2 OFFSET $3`, [status, lim, off])
    } else {
      rows = await db.all(`SELECT w.*, u.name as user_name, u.email FROM withdrawals w JOIN users u ON u.id=w.user_id ORDER BY w.created_at DESC LIMIT $1 OFFSET $2`, [lim, off])
    }
    res.json({ withdrawals: rows })
  } catch (err) { res.status(500).json({ error: 'Failed to fetch withdrawals.' }) }
})

export default router
