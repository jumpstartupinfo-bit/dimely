import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'

const router = Router()

// GET /api/referrals/dashboard
router.get('/dashboard', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user

  const myCode = db.prepare('SELECT * FROM referral_codes WHERE user_id = ?').get(user.id) as any

  const referrals = db.prepare(`
    SELECT rr.id, rr.status, rr.created_at, rr.expires_at, rr.activated_at,
           u.name as referred_name, u.username as referred_username,
           COALESCE(SUM(rc.commission_amount), 0) as total_commission,
           COUNT(rc.id) as booking_count
    FROM referral_relationships rr
    JOIN users u ON u.id = rr.referred_id
    LEFT JOIN referral_commissions rc ON rc.referral_relationship_id = rr.id AND rc.status IN ('eligible', 'paid')
    WHERE rr.referrer_id = ?
    GROUP BY rr.id
    ORDER BY rr.created_at DESC
  `).all(user.id) as any[]

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(rc.commission_amount), 0) as total_earned,
      COUNT(DISTINCT rc.id) as total_commissions
    FROM referral_commissions rc WHERE rc.referrer_id = ? AND rc.status IN ('eligible', 'paid')
  `).get(user.id) as any

  const activeCount = db.prepare(`
    SELECT COUNT(*) as count FROM referral_relationships WHERE referrer_id = ? AND status = 'active'
  `).get(user.id) as any

  res.json({
    code: myCode?.code ?? null,
    linkSlug: myCode?.link_slug ?? null,
    referrals,
    totalEarned: totals.total_earned,
    totalCommissions: totals.total_commissions,
    activeReferrals: activeCount.count,
  })
})

// GET /api/referrals/validate/:code — validate invite code before signup
router.get('/validate/:code', (req: Request, res: Response) => {
  const code = req.params.code.trim().toUpperCase()

  const refCode = db.prepare(`
    SELECT rc.code, u.name as referrer_name FROM referral_codes rc
    JOIN users u ON u.id = rc.user_id
    WHERE rc.code = ? AND rc.is_active = 1
  `).get(code) as any

  if (refCode) {
    res.json({ valid: true, type: 'referral', referrerName: refCode.referrer_name })
    return
  }

  const invCode = db.prepare(`
    SELECT code FROM invite_codes
    WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))
    AND use_count < max_uses
  `).get(code) as any

  if (invCode) {
    res.json({ valid: true, type: 'invite' })
    return
  }

  res.json({ valid: false })
})

export default router
