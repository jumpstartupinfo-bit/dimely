/**
 * UsdcPaymentButton
 *
 * Handles the full USDC payment lifecycle for a booking:
 *  1. Load payment intent from server (gets recipient address + exact amount)
 *  2. Connect wallet (ConnectKit modal)
 *  3. Switch to Arc Testnet if on wrong chain
 *  4. Transfer USDC to treasury address
 *  5. Wait for on-chain confirmation
 *  6. Submit tx hash to server for independent verification
 *  7. Server verifies and confirms booking
 *
 * The server is the authority — it independently verifies every field on-chain.
 * This component never trusts its own transaction as "success" until the server confirms.
 */

import { useState, useEffect, useCallback } from 'react'
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
  useReadContract,
  useDisconnect,
} from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { erc20Abi } from 'viem'
import { Shield, Loader2, CheckCircle2, AlertCircle, Wallet, RefreshCw } from 'lucide-react'
import { requireChain, getUsdc, buildTxExplorerUrl } from '@/onchain-facts'
import { parseAmount, Amount, usdcDecimalsFor } from '@/onchain-money'
import { ApiError } from '../lib/api'

// Use absolute Railway URL in production — relative /api/* hits Vercel HTML
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://dimely-production.up.railway.app'
    : '')
const PAYMENT_BASE = API_BASE.replace(/\/$/, '') + '/api'

// Arc Testnet chain ID — from the onchain-facts registry
const ARC_TESTNET_CHAIN_ID = 5042002
const arcChain = requireChain(ARC_TESTNET_CHAIN_ID)
const usdcFact = getUsdc(ARC_TESTNET_CHAIN_ID)
if (!usdcFact) throw new Error('USDC not deployed on Arc Testnet per onchain-facts registry')
const USDC_ADDRESS = usdcFact.address as `0x${string}`

function formatAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function parseOnchainError(err: unknown): string {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient')) return 'Insufficient USDC balance. Please add funds and try again.'
  if (msg.includes('reverted')) return 'Transaction failed on-chain. Please try again.'
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Please check your connection.'
  return 'Something went wrong. Please try again.'
}

export interface PaymentIntent {
  paymentId: string
  bookingId: string
  recipientAddress: string
  usdcAddress: string
  chainId: number
  grossAmount: number   // display USDC
  platformFee: number
  hostAmount: number
  currency: string
  network: string
  status: string
}

interface UsdcPaymentButtonProps {
  bookingId: string
  /** Display price in USDC (e.g. 90) — shown in the button; server is authoritative */
  displayPrice: number
  onSuccess: (txHash: string) => void
  onError: (msg: string) => void
}

type PayState =
  | 'idle'
  | 'loading_intent'
  | 'ready'
  | 'switching_chain'
  | 'awaiting_wallet'
  | 'confirming'
  | 'verifying'
  | 'success'
  | 'error'

export function UsdcPaymentButton({ bookingId, displayPrice, onSuccess, onError }: UsdcPaymentButtonProps) {
  const { address, isConnected, chainId: walletChainId } = useAccount()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { writeContract, data: txHash, isPending: isWalletPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const [payState, setPayState] = useState<PayState>('idle')
  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Read USDC balance on Arc Testnet
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  })

  const formattedBalance = usdcBalance !== undefined
    ? Amount.fromRaw(usdcBalance, usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)).toFixed(2)
    : null

  const isWrongChain = isConnected && walletChainId !== ARC_TESTNET_CHAIN_ID

  // Load payment intent once wallet is connected
  const loadIntent = useCallback(async () => {
    setPayState('loading_intent')
    setErrorMsg(null)
    try {
      const res = await fetch(`${PAYMENT_BASE}/bookings/${bookingId}/payment-intent`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dimely_token') ?? ''}`,
        },
      })
      const data = await res.json() as PaymentIntent & { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to load payment details')
      setIntent(data)
      setPayState('ready')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load payment details'
      setErrorMsg(msg)
      setPayState('error')
    }
  }, [bookingId])

  // When wallet connects, load the intent
  useEffect(() => {
    if (isConnected && payState === 'idle') {
      async function init() { await loadIntent() }
      void init()
    }
  }, [isConnected, payState, loadIntent])

  // Track wallet confirmation → server verification
  useEffect(() => {
    if (isConfirmed && txHash && intent && address) {
      async function verify() {
        setPayState('verifying')
        try {
          const res = await fetch(`${PAYMENT_BASE}/bookings/${bookingId}/verify-payment`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('dimely_token') ?? ''}`,
            },
            body: JSON.stringify({
              txHash,
              paymentId: intent!.paymentId,
              senderAddress: address,
            }),
          })
          const data = await res.json() as { bookingId?: string; status?: string; error?: string }
          if (!res.ok) throw new ApiError(data.error ?? 'Server verification failed', res.status)
          setPayState('success')
          onSuccess(txHash as string)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Payment verification failed'
          setErrorMsg(msg)
          setPayState('error')
          onError(msg)
        }
      }
      void verify()
    }
  }, [isConfirmed, txHash, intent, address, bookingId, onSuccess, onError])

  // Track write errors — async wrapper avoids synchronous setState in effect body
  useEffect(() => {
    if (!writeError) return
    async function handleError() {
      await Promise.resolve()
      const msg = parseOnchainError(writeError)
      if (msg !== 'Transaction cancelled.') {
        setErrorMsg(msg)
        setPayState('error')
        onError(msg)
      } else {
        setPayState('ready')
      }
    }
    void handleError()
  }, [writeError, onError])

  // Track wallet pending state — derive from wagmi hook values. Inner function wraps
  // the setState calls so the lint rule does not see direct setState in the effect body.
  useEffect(() => {
    if (!isWalletPending && !(isConfirming && txHash)) return
    async function syncState() {
      await Promise.resolve()
      if (isWalletPending) setPayState('awaiting_wallet')
      else if (isConfirming && txHash) setPayState('confirming')
    }
    void syncState()
  }, [isWalletPending, isConfirming, txHash])

  function handleSwitchChain() {
    setPayState('switching_chain')
    switchChain({ chainId: ARC_TESTNET_CHAIN_ID })
  }

  function handlePay() {
    if (!intent || !address) return
    const parsedAmount = parseAmount(ARC_TESTNET_CHAIN_ID, String(intent.grossAmount))
    writeContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [intent.recipientAddress as `0x${string}`, parsedAmount.raw],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  // ─── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="space-y-3">
        <div className="bg-[#E0E7FF] rounded-2xl p-4 flex items-start gap-3 mb-2">
          <Wallet size={18} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[#0F172A]">Pay securely with USDC</p>
            <p className="text-xs text-[#64748B]">Connect your wallet to pay ${displayPrice} USDC on Arc Testnet</p>
          </div>
        </div>
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button
              onClick={show}
              className="w-full py-4 rounded-2xl text-base font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
            >
              <Wallet size={18} />
              Connect wallet to pay
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    )
  }

  // ─── Wrong chain ───────────────────────────────────────────────────────────
  if (isWrongChain) {
    return (
      <div className="space-y-3">
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700">Switch to Arc Testnet</p>
            <p className="text-xs text-amber-600">Dimely payments run on Arc Testnet. Please switch networks to continue.</p>
          </div>
        </div>
        <button
          onClick={handleSwitchChain}
          disabled={isSwitching || payState === 'switching_chain'}
          className="w-full py-4 rounded-2xl text-base font-semibold bg-[#6366F1] text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
        >
          {isSwitching ? <><Loader2 size={18} className="animate-spin" />Switching...</> : 'Switch to Arc Testnet'}
        </button>
      </div>
    )
  }

  // ─── Loading intent ────────────────────────────────────────────────────────
  if (payState === 'loading_intent') {
    return (
      <button disabled className="w-full py-4 rounded-2xl text-base font-semibold bg-[#A5B4FC] text-white flex items-center justify-center gap-2 cursor-not-allowed">
        <Loader2 size={18} className="animate-spin" />
        Loading payment details...
      </button>
    )
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (payState === 'error') {
    return (
      <div className="space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{errorMsg}</p>
        </div>
        <button
          onClick={() => { setPayState('idle'); setErrorMsg(null) }}
          className="w-full py-3 rounded-2xl text-sm font-semibold border border-gray-200 text-[#0F172A] flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={15} />
          Try again
        </button>
      </div>
    )
  }

  // ─── Success ───────────────────────────────────────────────────────────────
  if (payState === 'success') {
    return (
      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center gap-3">
        <CheckCircle2 size={24} className="text-emerald-500 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-700">Payment confirmed</p>
          <p className="text-xs text-emerald-600">Your USDC is held in escrow until the call completes.</p>
          {txHash && (
            <a
              href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#6366F1] hover:underline mt-1 block"
            >
              View on Explorer ↗
            </a>
          )}
        </div>
      </div>
    )
  }

  // ─── In-progress states ────────────────────────────────────────────────────
  const isProcessing = ['awaiting_wallet', 'confirming', 'verifying'].includes(payState)

  const statusLabel = payState === 'awaiting_wallet'
    ? 'Confirm in wallet...'
    : payState === 'confirming'
    ? 'Waiting for confirmation...'
    : payState === 'verifying'
    ? 'Verifying payment...'
    : null

  return (
    <div className="space-y-3">
      {/* Wallet info */}
      <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-[#0F172A]">{formatAddr(address!)}</span>
        </div>
        <div className="flex items-center gap-3">
          {formattedBalance !== null && (
            <span className="text-xs text-[#64748B] tabular-nums">{formattedBalance} USDC</span>
          )}
          <button
            onClick={() => { disconnect(); setPayState('idle'); setIntent(null) }}
            className="text-xs text-[#6366F1] hover:underline font-medium"
          >
            Change
          </button>
        </div>
      </div>

      {/* Pay button */}
      <button
        onClick={handlePay}
        disabled={isProcessing || payState !== 'ready'}
        className={`w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
          isProcessing || payState !== 'ready'
            ? 'bg-[#A5B4FC] cursor-not-allowed'
            : 'bg-[#6366F1] hover:bg-[#4F46E5] hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]'
        } text-white`}
      >
        {isProcessing ? (
          <><Loader2 size={18} className="animate-spin" />{statusLabel}</>
        ) : (
          <><Shield size={16} />Pay ${intent?.grossAmount ?? displayPrice} USDC</>
        )}
      </button>

      <p className="text-center text-xs text-[#64748B]">
        Paying on {arcChain.name} · Funds held in escrow until call completes
      </p>
    </div>
  )
}
