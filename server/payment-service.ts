/**
 * server/payment-service.ts
 *
 * Server-side USDC payment verification and escrow lifecycle management.
 * All DB operations use async Postgres via db.get/db.run/db.all.
 */

import { createPublicClient, http, erc20Abi, parseEventLogs, type Hash, type Address } from 'viem'
import db from './db'
import { newId } from './utils'
import { chainConfig, usdcToRaw, rawToUsdc } from './chain-config'
import { createNotification } from './notifications'

// ─── Public RPC client (read-only) ───────────────────────────────────────────
export const publicClient = createPublicClient({
  transport: http(chainConfig.rpcUrl),
  chain: {
    id: chainConfig.chainId,
    name: chainConfig.env === 'mainnet' ? 'Arc' : 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [chainConfig.rpcUrl] } },
  },
})

export type PaymentStatus =
  | 'created' | 'awaiting_payment' | 'submitted' | 'verifying'
  | 'confirmed' | 'escrowed' | 'released' | 'refunded'
  | 'failed' | 'disputed' | 'expired'

// ─── Create a payment intent ──────────────────────────────────────────────────
export interface CreatePaymentIntentParams {
  bookingId: string
  guestUserId: string
  hostUserId: string
  grossAmount: number
  platformFee: number
  hostAmount: number
  idempotencyKey: string
}

export function createPaymentIntent(params: CreatePaymentIntentParams): string {
  // Returns sync-style ID; actual DB insert is fire-and-forget async
  const paymentId = newId()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  void (async () => {
    try {
      const existing = await db.get('SELECT id FROM payments WHERE idempotency_key = $1', [params.idempotencyKey])
      if (existing) return

      await db.run(`
        INSERT INTO payments(
          id, booking_id, customer_id, host_id, amount, platform_fee, host_amount,
          currency, status, idempotency_key, expires_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,'USDC','awaiting_payment',$8,$9,NOW(),NOW())
      `, [paymentId, params.bookingId, params.guestUserId, params.hostUserId,
          params.grossAmount, params.platformFee, params.hostAmount,
          params.idempotencyKey, expiresAt])
    } catch (err) {
      console.error('createPaymentIntent DB error:', err)
    }
  })()

  return paymentId
}

// ─── Verify a submitted USDC transfer on-chain ───────────────────────────────
export interface VerifyPaymentParams {
  paymentId: string
  bookingId: string
  txHash: string
  expectedGrossAmount: number
  expectedSenderAddress: string
  expectedRecipientAddress: string
}

export interface VerifyPaymentResult {
  ok: boolean
  error?: string
  confirmedAmount?: number
  blockNumber?: bigint
}

export async function verifyUsdcPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult> {
  await db.run(`UPDATE payments SET status='verifying', updated_at=NOW() WHERE id=$1`, [params.paymentId])

  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: params.txHash as Hash,
      confirmations: chainConfig.requiredConfirmations,
      timeout: 120_000,
    })

    if (receipt.status !== 'success') {
      await db.run(`UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`, [params.paymentId])
      return { ok: false, error: 'Transaction reverted on-chain' }
    }

    const logs = parseEventLogs({ abi: erc20Abi, logs: receipt.logs, eventName: 'Transfer' })

    const usdcAddress = chainConfig.usdcAddress.toLowerCase() as Address
    const expectedSender = params.expectedSenderAddress.toLowerCase() as Address
    const expectedRecipient = params.expectedRecipientAddress.toLowerCase() as Address
    const expectedRaw = usdcToRaw(params.expectedGrossAmount)

    const matchingTransfer = logs.find((log) => {
      const contractAddr = (log.address ?? '').toLowerCase()
      if (contractAddr !== usdcAddress) return false
      const { from, to, value } = log.args as { from: string; to: string; value: bigint }
      if ((from ?? '').toLowerCase() !== expectedSender) return false
      if ((to ?? '').toLowerCase() !== expectedRecipient) return false
      const diff = value >= expectedRaw ? value - expectedRaw : expectedRaw - value
      return diff <= 1n
    })

    if (!matchingTransfer) {
      await db.run(`UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`, [params.paymentId])
      return { ok: false, error: 'USDC transfer not found or amount/addresses do not match' }
    }

    const { value } = matchingTransfer.args as { value: bigint }
    const confirmedAmount = rawToUsdc(value)

    await db.run(`
      UPDATE payments SET status='confirmed', tx_hash=$1, updated_at=NOW() WHERE id=$2
    `, [params.txHash, params.paymentId])

    return { ok: true, confirmedAmount, blockNumber: receipt.blockNumber }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown verification error'
    await db.run(`UPDATE payments SET status='failed', updated_at=NOW() WHERE id=$1`, [params.paymentId])
    return { ok: false, error: msg }
  }
}

// ─── Confirm booking after verified payment ───────────────────────────────────
export function confirmBookingAfterPayment(
  paymentId: string,
  bookingId: string,
  txHash: string | null,
  hostUserId: string,
  guestUserId: string,
  bookingDate: string,
  bookingStartTime: string,
): void {
  void (async () => {
    try {
      await db.run(`UPDATE bookings SET status='confirmed', updated_at=NOW() WHERE id=$1 AND status='payment_pending'`, [bookingId])
      await db.run(`UPDATE escrow SET status='escrowed', updated_at=NOW() WHERE booking_id=$1`, [bookingId])
      await db.run(`UPDATE payments SET status='escrowed', updated_at=NOW() WHERE id=$1`, [paymentId])

      const booking = await db.get('SELECT * FROM bookings WHERE id=$1', [bookingId])
      if (booking) {
        await db.run(`
          INSERT INTO transactions(id, user_id, type, amount, reference_id, note)
          VALUES ($1,$2,'escrow_deposit',$3,$4,'USDC payment received and held in escrow')
        `, [newId(), guestUserId, booking.booking_amount, paymentId])
      }

      createNotification(hostUserId, 'booking_confirmed', 'Booking confirmed',
        `Payment received. Your call on ${bookingDate} at ${bookingStartTime} is confirmed.`, { bookingId })
      createNotification(guestUserId, 'payment_received', 'Payment confirmed',
        `Your payment is held in escrow. You're all set for ${bookingDate}.`, { bookingId })
    } catch (err) {
      console.error('confirmBookingAfterPayment error:', err)
    }
  })()
}

// ─── Settlement: release escrow to host after call completion ─────────────────
export interface SettleBookingResult {
  ok: boolean
  settlementId?: string
  hostEarnings?: number
  platformFee?: number
  error?: string
}

export function settleBooking(bookingId: string, commissionPercent: number): SettleBookingResult {
  const settlementId = newId()

  void (async () => {
    try {
      const booking = await db.get('SELECT * FROM bookings WHERE id=$1', [bookingId])
      if (!booking) return

      if (booking.status === 'disputed' || booking.status === 'cancelled') return

      const call = await db.get('SELECT * FROM calls WHERE booking_id=$1', [bookingId])
      if (!call) return

      const alreadySettled = await db.get(`SELECT id FROM transactions WHERE reference_id=$1 AND type='settlement'`, [bookingId])
      if (alreadySettled) return

      const hostEarnings = parseFloat(booking.host_amount)
      const platformFee = parseFloat(booking.platform_fee)
      const hostUserId = booking.host_id
      const guestUserId = booking.guest_id

      await db.run(`UPDATE escrow SET status='released', released_at=NOW(), updated_at=NOW() WHERE booking_id=$1`, [bookingId])
      await db.run(`
        UPDATE wallets SET held=GREATEST(0,held-$1), available=available+$1, total_earned=total_earned+$1
        WHERE user_id=$2
      `, [hostEarnings, hostUserId])
      await db.run(`
        INSERT INTO transactions(id,user_id,type,amount,reference_id,note)
        VALUES($1,$2,'settlement',$3,$4,'Booking settled — funds released to host')
      `, [settlementId, hostUserId, hostEarnings, bookingId])
      await db.run(`
        INSERT INTO transactions(id,user_id,type,amount,reference_id,note)
        VALUES($1,$2,'platform_fee',$3,$4,'Dimely platform fee (20%)')
      `, [newId(), hostUserId, platformFee, bookingId])
      await db.run(`UPDATE profiles SET booking_count=booking_count+1 WHERE user_id=$1`, [hostUserId])

      // Referral commission
      const refRel = await db.get(`
        SELECT rr.id, rr.referrer_id FROM referral_relationships rr
        WHERE rr.referred_id=$1 AND rr.status='active' AND rr.expires_at > NOW()
      `, [hostUserId])

      if (refRel) {
        const existing = await db.get('SELECT id FROM referral_commissions WHERE booking_id=$1', [bookingId])
        if (!existing) {
          const referralCommission = Math.round(platformFee * (commissionPercent / 100) * 100) / 100
          const commId = newId()
          await db.run(`
            INSERT INTO referral_commissions(
              id,referral_relationship_id,referrer_id,booking_id,
              platform_revenue,commission_rate,commission_amount,status,eligible_at
            ) VALUES($1,$2,$3,$4,$5,$6,$7,'eligible',NOW())
          `, [commId, refRel.id, refRel.referrer_id, bookingId, platformFee, commissionPercent, referralCommission])
          await db.run(`
            UPDATE wallets SET available=available+$1, total_earned=total_earned+$1 WHERE user_id=$2
          `, [referralCommission, refRel.referrer_id])
          await db.run(`
            INSERT INTO transactions(id,user_id,type,amount,reference_id,note)
            VALUES($1,$2,'referral_commission',$3,$4,'Referral commission — 20% of platform fee')
          `, [newId(), refRel.referrer_id, referralCommission, commId])
          createNotification(refRel.referrer_id, 'referral_earnings', 'Referral commission earned',
            `You earned $${referralCommission.toFixed(2)} from a booking in your network.`, { commissionId: commId })
        }
      }

      createNotification(hostUserId, 'payment_released', 'Payment released',
        `$${hostEarnings.toFixed(2)} has been added to your available balance.`, { bookingId })
      createNotification(guestUserId, 'call_completed', 'Call completed',
        'Your call is complete. We hope it was worth every minute.', { bookingId })
    } catch (err) {
      console.error('settleBooking error:', err)
    }
  })()

  return { ok: true, settlementId }
}

// ─── Reverse a referral commission (refund / dispute) ────────────────────────
export function reverseReferralCommission(bookingId: string, reason: string): void {
  void (async () => {
    try {
      const comm = await db.get(`SELECT * FROM referral_commissions WHERE booking_id=$1 AND status='eligible'`, [bookingId])
      if (!comm) return

      await db.run(`UPDATE referral_commissions SET status='reversed', updated_at=NOW() WHERE booking_id=$1`, [bookingId])
      await db.run(`UPDATE wallets SET available=GREATEST(0,available-$1) WHERE user_id=$2`, [comm.commission_amount, comm.referrer_id])
      await db.run(`
        INSERT INTO transactions(id,user_id,type,amount,reference_id,note)
        VALUES($1,$2,'referral_reversal',$3,$4,$5)
      `, [newId(), comm.referrer_id, comm.commission_amount, comm.id, `Commission reversed: ${reason}`])
    } catch (err) {
      console.error('reverseReferralCommission error:', err)
    }
  })()
}

// ─── Execute a server-signed USDC withdrawal ─────────────────────────────────
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

  await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: chainConfig.requiredConfirmations,
  })

  await db.run(`UPDATE withdrawals SET status='completed', tx_hash=$1, updated_at=NOW() WHERE id=$2`, [txHash, withdrawalId])
  await db.run(`UPDATE transactions SET note='Withdrawal completed', updated_at=NOW() WHERE reference_id=$1`, [withdrawalId])

  return { txHash }
}
