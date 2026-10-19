import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'
import { executeWithdrawal } from '../payment-service'
import { chainConfig } from '../chain-config'

const router = Router()

// GET /api/earnings/summary
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const wallet = await db.get('SELECT * FROM wallets WHERE user_id = $1', [user.id])

    const totalCalls = await db.get(
      `SELECT COUNT(*) as count FROM bookings WHERE host_id = $1 AND status = 'completed'`, [user.id])

    const thisMonth = await db.get(`
      SELECT COALESCE(SUM(host_amount), 0) as total FROM bookings
      WHERE host_id = $1 AND status = 'completed'
      AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())
    `, [user.id])

    const referralEarnings = await db.get(`
      SELECT COALESCE(SUM(commission_amount), 0) as total
      FROM referral_commissions WHERE referrer_id = $1 AND status IN ('eligible', 'paid')
    `, [user.id])

    const minutesBooked = await db.get(`
      SELECT COALESCE(SUM(duration_mins), 0) as total FROM bookings
      WHERE host_id = $1 AND status = 'completed'
    `, [user.id])

    const last7 = await db.all(`
      SELECT date::text, COALESCE(SUM(host_amount), 0) as total
      FROM bookings
      WHERE host_id = $1 AND status = 'completed'
      AND date >= CURRENT_DATE - INTERVAL '6 days'
      GROUP BY date ORDER BY date ASC
    `, [user.id])

    const days: Record<string, number> = {}
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
      days[d.toISOString().slice(0, 10)] = 0
    }
    for (const row of last7) days[row.date] = parseFloat(row.total)

    res.json({
      available: parseFloat(wallet?.available ?? 0),
      held: parseFloat(wallet?.held ?? 0),
      totalEarned: parseFloat(wallet?.total_earned ?? 0),
      thisMonth: parseFloat(thisMonth?.total ?? 0),
      referralEarnings: parseFloat(referralEarnings?.total ?? 0),
      totalCalls: parseInt(totalCalls?.count ?? 0),
      minutesBooked: parseInt(minutesBooked?.total ?? 0),
      last7Days: Object.values(days),
      last7Labels: Object.keys(days).map((d) => d.slice(5)),
    })
  } catch (err) {
    console.error('Earnings summary error:', err)
    res.status(500).json({ error: 'Failed to fetch earnings summary.' })
  }
})

// GET /api/earnings/transactions
router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { limit = '20', offset = '0' } = req.query

    const rows = await db.all(`
      SELECT b.id, b.date, b.duration_mins, b.host_amount, b.booking_amount, b.platform_fee,
             b.status, b.guest_name, b.updated_at, b.guest_id
      FROM bookings b
      WHERE b.host_id = $1
      ORDER BY b.date DESC, b.start_time DESC
      LIMIT $2 OFFSET $3
    `, [user.id, parseInt(limit as string, 10), parseInt(offset as string, 10)])

    res.json({ transactions: rows })
  } catch (err) {
    console.error('Transactions error:', err)
    res.status(500).json({ error: 'Failed to fetch transactions.' })
  }
})

// POST /api/earnings/withdraw
router.post('/withdraw', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { amount, destinationAddress, idempotencyKey } = req.body

    if (!amount || !destinationAddress || !idempotencyKey) {
      res.status(400).json({ error: 'amount, destinationAddress, and idempotencyKey are required' }); return
    }

    const existing = await db.get('SELECT id, status FROM withdrawals WHERE idempotency_key = $1', [idempotencyKey])
    if (existing) { res.json({ withdrawalId: existing.id, status: existing.status, idempotent: true }); return }

    const withdrawAmount = parseFloat(amount)
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      res.status(400).json({ error: 'Invalid withdrawal amount' }); return
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress) || destinationAddress === '0x' + '0'.repeat(40)) {
      res.status(400).json({ error: 'Invalid destination wallet address' }); return
    }
    if (withdrawAmount < chainConfig.minWithdrawalAmount) {
      res.status(400).json({ error: `Minimum withdrawal is $${chainConfig.minWithdrawalAmount.toFixed(2)} USDC` }); return
    }

    const wallet = await db.get('SELECT available FROM wallets WHERE user_id = $1', [user.id])
    if (!wallet || parseFloat(wallet.available) < withdrawAmount) {
      res.status(400).json({ error: `Insufficient balance. Available: $${parseFloat(wallet?.available ?? 0).toFixed(2)}` }); return
    }

    const wdId = newId()
    await db.run(`INSERT INTO withdrawals(id,user_id,amount,destination_address,status,idempotency_key) VALUES($1,$2,$3,$4,'processing',$5)`,
      [wdId, user.id, withdrawAmount, destinationAddress, idempotencyKey])
    await db.run(`UPDATE wallets SET available=available-$1 WHERE user_id=$2`, [withdrawAmount, user.id])
    await db.run(`INSERT INTO transactions(id,user_id,type,amount,reference_id,note) VALUES($1,$2,'withdrawal',$3,$4,'Withdrawal initiated')`,
      [newId(), user.id, withdrawAmount, wdId])

    if (chainConfig.serverSignerKey) {
      try {
        const { txHash } = await executeWithdrawal(wdId, destinationAddress, withdrawAmount)
        res.status(201).json({ withdrawalId: wdId, status: 'completed', amount: withdrawAmount, txHash })
      } catch (err) {
        await db.run(`UPDATE wallets SET available=available+$1 WHERE user_id=$2`, [withdrawAmount, user.id])
        await db.run(`UPDATE withdrawals SET status='failed' WHERE id=$1`, [wdId])
        const msg = err instanceof Error ? err.message : 'Transfer failed'
        res.status(500).json({ error: `Withdrawal failed: ${msg}` })
      }
    } else {
      res.status(201).json({
        withdrawalId: wdId,
        status: 'processing',
        amount: withdrawAmount,
        note: chainConfig.env === 'testnet'
          ? 'Testnet: withdrawal queued (set SERVER_SIGNER_PRIVATE_KEY for automatic processing)'
          : 'Withdrawal queued for processing',
      })
    }
  } catch (err) {
    console.error('Withdrawal error:', err)
    res.status(500).json({ error: 'Withdrawal failed. Please try again.' })
  }
})

export default router
