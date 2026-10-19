import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'

const router = Router()

// GET /api/referrals/dashboard
router.get('/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user

    const myCode = await db.get('SELECT * FROM referral_codes WHERE user_id = $1', [user.id])

    const referrals = await db.all(`
      SELECT rr.id, rr.status, rr.created_at, rr.expires_at, rr.activated_at,
             u.name as referred_name, u.username as referred_username,
             COALESCE(SUM(rc.commission_amount), 0) as total_commission,
             COUNT(rc.id) as booking_count
      FROM referral_relationships rr
      JOIN users u ON u.id = rr.referred_id
      LEFT JOIN referral_commissions rc ON rc.referral_relationship_id = rr.id AND rc.status IN ('eligible', 'paid')
      WHERE rr.referrer_id = $1
      GROUP BY rr.id, u.name, u.username
      ORDER BY rr.created_at DESC
    `, [user.id])

    const totals = await db.get(`
      SELECT
        COALESCE(SUM(rc.commission_amount), 0) as total_earned,
        COUNT(DISTINCT rc.id) as total_commissions
      FROM referral_commissions rc WHERE rc.referrer_id = $1 AND rc.status IN ('eligible', 'paid')
    `, [user.id])

    const activeCount = await db.get(
      `SELECT COUNT(*) as count FROM referral_relationships WHERE referrer_id = $1 AND status = 'active'`, [user.id])

    res.json({
      code: myCode?.code ?? null,
      linkSlug: myCode?.link_slug ?? null,
      referrals,
      totalEarned: parseFloat(totals?.total_earned ?? 0),
      totalCommissions: parseInt(totals?.total_commissions ?? 0),
      activeReferrals: parseInt(activeCount?.count ?? 0),
    })
  } catch (err) {
    console.error('Referrals dashboard error:', err)
    res.status(500).json({ error: 'Failed to fetch referral data.' })
  }
})

// GET /api/referrals/validate/:code
router.get('/validate/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params.code.trim().toUpperCase()

    const refCode = await db.get(`
      SELECT rc.code, u.name as referrer_name FROM referral_codes rc
      JOIN users u ON u.id = rc.user_id
      WHERE rc.code = $1 AND rc.is_active = true
    `, [code])

    if (refCode) { res.json({ valid: true, type: 'referral', referrerName: refCode.referrer_name }); return }

    res.json({ valid: false })
  } catch (err) {
    res.status(500).json({ error: 'Failed to validate code.' })
  }
})

export default router
