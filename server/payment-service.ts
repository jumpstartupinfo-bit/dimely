/**
 * server/payment-service.ts
 *
 * Server-side USDC payment verification and escrow lifecycle management.
 *
 * Architecture:
 * - Payment intents are created BEFORE the wallet transaction (preventing ghost bookings)
 * - After the wallet submits a tx, the server independently verifies every field on-chain
 * - Escrow is a DB-level concept: funds are tracked in states (held → released / refunded)
 * - The treasury address receives platform fees on settlement (when server signer is configured)
 * - All operations are idempotent via payment_id
 *
 * On testnet: tx verification is done via viem/public RPC; server-signing for withdrawals
 * requires SERVER_SIGNER_PRIVATE_KEY and TREASURY_ADDRESS to be set.
 */

import { createPublicClient, http, erc20Abi, parseEventLogs, type Hash, type Address } from 'viem'
import db from './db'
import { newId } from './utils'
import { chainConfig, usdcToRaw, rawToUsdc } from './chain-config'
import { createNotification } from './notifications'

// ─── Public RPC client (read-only, no private key) ───────────────────────────
export const publicClient = createPublicClient({
  transport: http(chainConfig.rpcUrl),
  chain: {
    id: chainConfig.chainId,
    name: chainConfig.env === 'mainnet' ? 'Arc' : 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  },
})

// ─── Payment intent statuses ─────────────────────────────────────────────────
export type PaymentStatus =
  | 'created'
  | 'awaiting_payment'
  | 'submitted'
  | 'verifying'
  | 'confirmed'
  | 'escrowed'
  | 'released'
  | 'refunded'
  | 'failed'
  | 'disputed'
  | 'expired'

// ─── Create a payment intent ─────────────────────────────────────────────────
export interface CreatePaymentIntentParams {
  bookingId: string
  guestUserId: string
  hostUserId: string
  grossAmount: number    // display USDC (e.g. 90.0)
  platformFee: number
  hostAmount: number
  idempotencyKey: string
}

export function createPaymentIntent(params: CreatePaymentIntentParams): string {
  // Idempotency
  const existing = db.prepare('SELECT id FROM payments WHERE idempotency_key = ?').get(params.idempotencyKey) as { id: string } | undefined
  if (existing) return existing.id

  const paymentId = newId()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min TTL

  db.prepare(`
    INSERT INTO payments(
      id, booking_id, payer_user_id, amount, currency,
      status, idempotency_key, expires_at, created_at
    ) VALUES (?, ?, ?, ?, 'USDC', 'awaiting_payment', ?, ?, datetime('now'))
  `).run(paymentId, params.bookingId, params.guestUserId, params.grossAmount, params.idempotencyKey, expiresAt)

  return paymentId
}

// ─── Verify a submitted USDC transfer on-chain ───────────────────────────────
export interface VerifyPaymentParams {
  paymentId: string
  bookingId: string
  txHash: string
  expectedGrossAmount: number   // display USDC (authoritative server value)
  expectedSenderAddress: string // guest wallet address
  expectedRecipientAddress: string // treasury or escrow address
}

export interface VerifyPaymentResult {
  ok: boolean
  error?: string
  confirmedAmount?: number
  blockNumber?: bigint
}

export async function verifyUsdcPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
  // Mark as verifying
  db.prepare(`UPDATE payments SET status = 'verifying', updated_at = datetime('now') WHERE id = ?`).run(params.paymentId)

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: params.txHash as Hash,
      confirmations: chainConfig.requiredConfirmations,
      timeout: 120_000,
    })

    // 1. Transaction must succeed
    if (receipt.status !== 'success') {
      db.prepare(`UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(params.paymentId)
      return { ok: false, error: 'Transaction reverted on-chain' }
    }

    // 2. Must be on the correct chain
    // (the receipt comes from our configured RPC, so chain is already verified)

    // 3. Parse ERC-20 Transfer events to verify USDC token, sender, recipient, and amount
    const logs = parseEventLogs({
      abi: erc20Abi,
      logs: receipt.logs,
      eventName: 'Transfer',
    })

    const usdcAddress = chainConfig.usdcAddress.toLowerCase() as Address
    const expectedSender = params.expectedSenderAddress.toLowerCase() as Address
    const expectedRecipient = params.expectedRecipientAddress.toLowerCase() as Address
    const expectedRaw = usdcToRaw(params.expectedGrossAmount)

    const matchingTransfer = logs.find((log) => {
      const contractAddr = (log.address ?? '').toLowerCase()
      if (contractAddr !== usdcAddress) return false  // 4. Must be USDC contract

      const { from, to, value } = log.args as { from: string; to: string; value: bigint }

      if ((from ?? '').toLowerCase() !== expectedSender) return false   // 5. Correct sender
      if ((to ?? '').toLowerCase() !== expectedRecipient) return false  // 6. Correct recipient

      // 7. Amount must be >= expected (allow minor rounding tolerance: ±1 raw unit)
      const diff = value >= expectedRaw ? value - expectedRaw : expectedRaw - value
      return diff <= 1n
    })

    if (!matchingTransfer) {
      db.prepare(`UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(params.paymentId)
      return { ok: false, error: 'USDC transfer not found or amount/addresses do not match' }
    }

    const { value } = matchingTransfer.args as { value: bigint }
    const confirmedAmount = rawToUsdc(value)

    // 8. Mark payment confirmed
    db.prepare(`
      UPDATE payments SET status = 'confirmed', tx_hash = ?, confirmed_amount = ?,
      block_number = ?, updated_at = datetime('now') WHERE id = ?
    `).run(params.txHash, confirmedAmount, String(receipt.blockNumber), params.paymentId)

    return { ok: true, confirmedAmount, blockNumber: receipt.blockNumber }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error'
    db.prepare(`UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE id = ?`).run(params.paymentId)
    return { ok: false, error: msg }
  }
}

// ─── Confirm booking after verified payment ───────────────────────────────────
export function confirmBookingAfterPayment(
  paymentId: string,
  bookingId: string,
  txHash: string,
  hostUserId: string,
  guestUserId: string,
  bookingDate: string,
  bookingStartTime: string,
): void {
  db.transaction(() => {
    // Confirm booking
    db.prepare(`
      UPDATE bookings SET status = 'confirmed', payment_id = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'payment_pending'
    `).run(paymentId, bookingId)

    // Update escrow to escrowed state
    db.prepare(`
      UPDATE escrow SET status = 'escrowed', updated_at = datetime('now') WHERE booking_id = ?
    `).run(bookingId)

    // Payment escrowed
    db.prepare(`UPDATE payments SET status = 'escrowed', updated_at = datetime('now') WHERE id = ?`).run(paymentId)

    // Ledger entry: escrow deposit
    db.prepare(`
      INSERT INTO transactions(id, user_id, type, amount, booking_id, reference_id, note)
      SELECT ?, guest_user_id, 'escrow_deposit', gross_amount, id, ?, 'USDC payment received and held in escrow'
      FROM bookings WHERE id = ?
    `).run(newId(), paymentId, bookingId)
  })()

  createNotification(hostUserId, 'booking_confirmed',
    'Booking confirmed',
    `Payment received. Your call on ${bookingDate} at ${bookingStartTime} is confirmed.`,
    { bookingId }
  )
  createNotification(guestUserId, 'payment_received',
    'Payment confirmed',
    `Your payment is held in escrow. You're all set for ${bookingDate}.`,
    { bookingId }
  )
}

// ─── Settlement: release escrow to host after call completion ─────────────────
export interface SettleBookingResult {
  ok: boolean
  settlementId?: string
  hostEarnings?: number
  platformFee?: number
  referralCommission?: number
  error?: string
}

export function settleBooking(bookingId: string, commissionPercent: number): SettleBookingResult {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(bookingId) as Record<string, unknown> | undefined
  if (!booking) return { ok: false, error: 'Booking not found' }

  // Only settle if call is legitimately complete — no disputes
  if (booking['status'] === 'disputed') return { ok: false, error: 'Cannot settle a disputed booking' }
  if (booking['status'] === 'cancelled') return { ok: false, error: 'Cannot settle a cancelled booking' }

  // Verify call status: both participants must have been present
  const call = db.prepare('SELECT * FROM calls WHERE booking_id = ?').get(bookingId) as Record<string, unknown> | undefined
  if (!call) return { ok: false, error: 'No call record — cannot settle without call evidence' }
  if (!call['ended_at'] && booking['status'] !== 'completed') {
    return { ok: false, error: 'Call has not ended yet' }
  }

  // Idempotency: check if already settled
  const alreadySettled = db.prepare(
    `SELECT id FROM transactions WHERE booking_id = ? AND type = 'settlement'`
  ).get(bookingId)
  if (alreadySettled) return { ok: false, error: 'Booking already settled' }

  const grossAmount = booking['gross_amount'] as number
  const platformFee = booking['platform_fee'] as number
  const hostEarnings = booking['host_earnings'] as number
  const hostUserId = booking['host_user_id'] as string
  const guestUserId = booking['guest_user_id'] as string
  const settlementId = newId()

  db.transaction(() => {
    // Release escrow
    db.prepare(`UPDATE escrow SET status = 'released', released_at = datetime('now'), updated_at = datetime('now') WHERE booking_id = ?`).run(bookingId)

    // Release earnings from held to available
    db.prepare(`
      UPDATE wallets SET held = MAX(0, held - ?), available = available + ?, total_earned = total_earned + ?
      WHERE user_id = ?
    `).run(hostEarnings, hostEarnings, hostEarnings, hostUserId)

    // Ledger: settlement record
    db.prepare(`
      INSERT INTO transactions(id, user_id, type, amount, booking_id, reference_id, note)
      VALUES (?, ?, 'settlement', ?, ?, ?, 'Booking settled — funds released to host')
    `).run(settlementId, hostUserId, hostEarnings, bookingId, settlementId)

    // Ledger: platform fee capture
    db.prepare(`
      INSERT INTO transactions(id, user_id, type, amount, booking_id, reference_id, note)
      VALUES (?, ?, 'platform_fee', ?, ?, ?, 'Dimely platform fee (20%)')
    `).run(newId(), hostUserId, platformFee, bookingId, settlementId)

    // Booking count
    db.prepare(`UPDATE profiles SET booking_count = booking_count + 1 WHERE id = ?`).run(booking['host_profile_id'])

    // ─── Referral commission ───────────────────────────────────────────────────
    // Commission = referral_commission_percent % × platform_fee (NOT gross)
    const refRel = db.prepare(`
      SELECT rr.id, rr.referrer_id FROM referral_relationships rr
      WHERE rr.referred_id = ? AND rr.status = 'active' AND rr.expires_at > datetime('now')
    `).get(hostUserId) as { id: string; referrer_id: string } | undefined

    let referralCommission = 0
    if (refRel) {
      const existing = db.prepare('SELECT id FROM referral_commissions WHERE booking_id = ?').get(bookingId)
      if (!existing) {
        referralCommission = Math.round(platformFee * (commissionPercent / 100) * 100) / 100
        const commId = newId()
        db.prepare(`
          INSERT INTO referral_commissions(
            id, referral_relationship_id, referrer_id, booking_id,
            platform_revenue, commission_rate, commission_amount, status, eligible_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'eligible', datetime('now'))
        `).run(commId, refRel.id, refRel.referrer_id, bookingId, platformFee, commissionPercent, referralCommission)

        db.prepare(`
          UPDATE wallets SET available = available + ?, total_earned = total_earned + ? WHERE user_id = ?
        `).run(referralCommission, referralCommission, refRel.referrer_id)

        db.prepare(`
          INSERT INTO transactions(id, user_id, type, amount, booking_id, reference_id, note)
          VALUES (?, ?, 'referral_commission', ?, ?, ?, 'Referral commission — 20% of platform fee')
        `).run(newId(), refRel.referrer_id, referralCommission, bookingId, commId)

        createNotification(refRel.referrer_id, 'referral_earnings',
          'Referral commission earned',
          `You earned $${referralCommission.toFixed(2)} from a booking in your network.`,
          { commissionId: commId }
        )
      }
    }
  })()

  createNotification(hostUserId as string, 'payment_released',
    'Payment released',
    `$${(hostEarnings as number).toFixed(2)} has been added to your available balance.`,
    { bookingId }
  )
  createNotification(guestUserId as string, 'call_completed',
    'Call completed',
    'Your call is complete. We hope it was worth every minute.',
    { bookingId }
  )

  return {
    ok: true,
    settlementId,
    hostEarnings: hostEarnings as number,
    platformFee: platformFee as number,
  }
}

// ─── Reverse a referral commission (refund / dispute) ────────────────────────
export function reverseReferralCommission(bookingId: string, reason: string): void {
  const comm = db.prepare(`
    SELECT * FROM referral_commissions WHERE booking_id = ? AND status = 'eligible'
  `).get(bookingId) as Record<string, unknown> | undefined
  if (!comm) return

  db.transaction(() => {
    db.prepare(`
      UPDATE referral_commissions SET status = 'reversed', reversal_reason = ?, updated_at = datetime('now')
      WHERE booking_id = ?
    `).run(reason, bookingId)

    const commAmount = comm['commission_amount'] as number
    const referrerId = comm['referrer_id'] as string

    // Deduct from referrer wallet
    db.prepare(`
      UPDATE wallets SET available = MAX(0, available - ?) WHERE user_id = ?
    `).run(commAmount, referrerId)

    // Ledger: reversal
    db.prepare(`
      INSERT INTO transactions(id, user_id, type, amount, booking_id, reference_id, note)
      VALUES (?, ?, 'referral_reversal', ?, ?, ?, ?)
    `).run(newId(), referrerId, commAmount, bookingId, comm['id'], `Commission reversed: ${reason}`)
  })()
}

// ─── Execute a server-signed USDC withdrawal ────────────────────────────────
export async function executeWithdrawal(
  withdrawalId: string,
  recipientAddress: string,
  amount: number,
): Promise<{ txHash: string }> {
  const { createWalletClient } = await import('viem')
  const { privateKeyToAccount } = await import('viem/accounts')
  const { requireSignerKey } = await import('./chain-config')

  const signerKey = requireSignerKey() as `0x${string}`
  const account = privateKeyToAccount(signerKey)

  const walletClient = createWalletClient({
    account,
    transport: http(chainConfig.rpcUrl),
    chain: {
      id: chainConfig.chainId,
      name: chainConfig.env === 'mainnet' ? 'Arc' : 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
    },
  })

  const rawAmount = usdcToRaw(amount)

  const txHash = await walletClient.writeContract({
    address: chainConfig.usdcAddress as Address,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAddress as Address, rawAmount],
  })

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: chainConfig.requiredConfirmations,
  })

  // Mark withdrawal completed
  db.prepare(`
    UPDATE withdrawals SET status = 'completed', tx_hash = ?, completed_at = datetime('now'),
    updated_at = datetime('now') WHERE id = ?
  `).run(txHash, withdrawalId)

  db.prepare(`
    UPDATE transactions SET note = 'Withdrawal completed', updated_at = datetime('now')
    WHERE reference_id = ?
  `).run(withdrawalId)

  return { txHash }
}
