import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'
import { executeWithdrawal } from '../payment-service'
import { chainConfig } from '../chain-config'

const router = Router()

// GET /api/earnings/summary
router.get('/summary', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id) as any

  const totalCalls = db.prepare(`
    SELECT COUNT(*) as count FROM bookings WHERE host_user_id = ? AND status = 'completed'
  `).get(user.id) as any

  const thisMonth = db.prepare(`
    SELECT COALESCE(SUM(host_earnings), 0) as total FROM bookings
    WHERE host_user_id = ? AND status = 'completed'
    AND strftime('%Y-%m', completed_at) = strftime('%Y-%m', 'now')
  `).get(user.id) as any

  const referralEarnings = db.prepare(`
    SELECT COALESCE(SUM(commission_amount), 0) as total
    FROM referral_commissions WHERE referrer_id = ? AND status IN ('eligible', 'paid')
  `).get(user.id) as any

  const minutesBooked = db.prepare(`
    SELECT COALESCE(SUM(duration), 0) as total FROM bookings
    WHERE host_user_id = ? AND status = 'completed'
  `).get(user.id) as any

  // Last 7 days
  const last7 = db.prepare(`
    SELECT date, COALESCE(SUM(host_earnings), 0) as total
    FROM bookings
    WHERE host_user_id = ? AND status = 'completed'
    AND date >= date('now', '-6 days')
    GROUP BY date ORDER BY date ASC
  `).all(user.id) as any[]

  const days: Record<string, number> = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
    days[d.toISOString().slice(0, 10)] = 0
  }
  for (const row of last7) days[row.date] = row.total

  res.json({
    available: wallet?.available ?? 0,
    held: wallet?.held ?? 0,
    totalEarned: wallet?.total_earned ?? 0,
    thisMonth: thisMonth.total,
    referralEarnings: referralEarnings.total,
    totalCalls: totalCalls.count,
    minutesBooked: minutesBooked.total,
    last7Days: Object.values(days),
    last7Labels: Object.keys(days).map((d) => d.slice(5)), // "MM-DD"
  })
})

// GET /api/earnings/transactions
router.get('/transactions', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const { limit = '20', offset = '0' } = req.query

  const rows = db.prepare(`
    SELECT b.id, b.date, b.duration, b.host_earnings, b.gross_amount, b.platform_fee,
           b.status, b.guest_name, b.completed_at, b.guest_user_id
    FROM bookings b
    WHERE b.host_user_id = ?
    ORDER BY b.date DESC, b.start_time DESC
    LIMIT ? OFFSET ?
  `).all(user.id, parseInt(limit as string, 10), parseInt(offset as string, 10)) as any[]

  res.json({ transactions: rows })
})

// POST /api/earnings/withdraw
router.post('/withdraw', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const { amount, destinationAddress, idempotencyKey } = req.body

    if (!amount || !destinationAddress || !idempotencyKey) {
      res.status(400).json({ error: 'amount, destinationAddress, and idempotencyKey are required' })
      return
    }

    // Idempotency check
    const existing = db.prepare('SELECT id, status FROM withdrawals WHERE idempotency_key = ?').get(idempotencyKey) as any
    if (existing) {
      res.json({ withdrawalId: existing.id, status: existing.status, idempotent: true })
      return
    }

    const withdrawAmount = parseFloat(amount)
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      res.status(400).json({ error: 'Invalid withdrawal amount' })
      return
    }

    // Validate destination address (must be a non-zero Ethereum address)
    if (!/^0x[0-9a-fA-F]{40}$/.test(destinationAddress) || destinationAddress === '0x' + '0'.repeat(40)) {
      res.status(400).json({ error: 'Invalid destination wallet address' })
      return
    }

    if (withdrawAmount < chainConfig.minWithdrawalAmount) {
      res.status(400).json({ error: `Minimum withdrawal is $${chainConfig.minWithdrawalAmount.toFixed(2)} USDC` })
      return
    }

    const result = db.transaction(() => {
      const wallet = db.prepare('SELECT available FROM wallets WHERE user_id = ?').get(user.id) as any
      if (!wallet || wallet.available < withdrawAmount) {
        return { error: `Insufficient balance. Available: $${wallet?.available?.toFixed(2) ?? '0.00'}` }
      }

      const wdId = newId()
      db.prepare(`
        INSERT INTO withdrawals(id, user_id, amount, destination_address, status, idempotency_key)
        VALUES (?, ?, ?, ?, 'processing', ?)
      `).run(wdId, user.id, withdrawAmount, destinationAddress, idempotencyKey)

      // Reserve the amount immediately (prevents double-withdrawal)
      db.prepare(`UPDATE wallets SET available = available - ? WHERE user_id = ?`).run(withdrawAmount, user.id)

      db.prepare(`
        INSERT INTO transactions(id, user_id, type, amount, reference_id, note)
        VALUES (?, ?, 'withdrawal', ?, ?, 'Withdrawal initiated')
      `).run(newId(), user.id, withdrawAmount, wdId)

      return { withdrawalId: wdId }
    })()

    if ('error' in result) {
      res.status(400).json({ error: result.error })
      return
    }

    const { withdrawalId } = result as { withdrawalId: string }

    // Attempt on-chain transfer if server signer is configured
    if (chainConfig.serverSignerKey) {
      try {
        const { txHash } = await executeWithdrawal(withdrawalId, destinationAddress, withdrawAmount)
        res.status(201).json({ withdrawalId, status: 'completed', amount: withdrawAmount, txHash })
      } catch (err) {
        // On-chain transfer failed — refund the reserved amount
        db.prepare(`UPDATE wallets SET available = available + ? WHERE user_id = ?`).run(withdrawAmount, user.id)
        db.prepare(`UPDATE withdrawals SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(withdrawalId)
        const msg = err instanceof Error ? err.message : 'Transfer failed'
        res.status(500).json({ error: `Withdrawal failed: ${msg}` })
      }
    } else {
      // No server signer — withdrawal queued for manual processing (testnet/demo mode)
      res.status(201).json({
        withdrawalId,
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
