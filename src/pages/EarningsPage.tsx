import { useState, useEffect } from 'react'
import { TrendingUp, DollarSign, Clock, Users, ChevronRight, CheckCircle2, AlertCircle, Loader2, Wallet } from 'lucide-react'
import { earnings as earningsApi, type EarningsSummary, type Transaction } from '../lib/api'
import { MOCK_EARNINGS } from '../data/mockData'
import { v4 as uuidv4 } from 'uuid'
import type { Page } from '../App'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'

interface EarningsPageProps {
  onNavigate: (page: Page, username?: string) => void
}

export function EarningsPage({ onNavigate }: EarningsPageProps) {
  const [summary, setSummary] = useState<EarningsSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const { address: walletAddress, isConnected: walletConnected } = useAccount()

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const [sumRes, txRes] = await Promise.all([
          earningsApi.summary(),
          earningsApi.transactions(),
        ])
        if (mounted) {
          setSummary(sumRes)
          setTransactions(txRes.transactions)
        }
      } catch {
        // Fall back to mock data for demo
        if (mounted) {
          setSummary({
            available: 504,
            held: 144,
            totalEarned: 648,
            thisMonth: 648,
            referralEarnings: 62.40,
            totalCalls: 5,
            minutesBooked: 165,
            last7Days: [180, 0, 288, 0, 0, 0, 180],
            last7Labels: ['10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-07'],
          })
          setTransactions(MOCK_EARNINGS)
        }
      } finally {
        if (mounted) setLoadingData(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  async function handleWithdraw() {
    if (!summary || summary.available <= 0) return
    if (!walletConnected || !walletAddress) return
    setWithdrawing(true)
    setWithdrawError(null)
    try {
      await earningsApi.withdraw(
        summary.available,
        walletAddress,
        uuidv4()
      )
      setWithdrawn(true)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed. Please try again.'
      setWithdrawError(msg)
    } finally {
      setWithdrawing(false)
    }
  }

  const available = summary?.available ?? 0
  const held = summary?.held ?? 0
  const thisMonth = summary?.thisMonth ?? 0
  const referralEarnings = summary?.referralEarnings ?? 0
  const totalCalls = summary?.totalCalls ?? 0
  const last7 = summary?.last7Days ?? [0, 0, 0, 0, 0, 0, 0]

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Earnings
            </h1>
            <p className="text-sm text-[#64748B]">October 2026</p>
          </div>
          <button
            onClick={() => onNavigate('invite')}
            className="text-xs bg-[#E0E7FF] text-[#6366F1] font-semibold px-3 py-2 rounded-xl hover:bg-[#C7D2FE] transition-colors"
          >
            Invite & Earn
          </button>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : (
          <>
            {/* Balance card */}
            <div className="bg-gradient-to-br from-[#6366F1] to-[#818CF8] rounded-2xl p-6 mb-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <p className="text-[#A5B4FC] text-sm font-medium mb-1 relative">Available balance</p>
              <p
                className="text-5xl font-bold text-white tabular-nums relative mb-4"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
              >
                ${available.toFixed(2)}
              </p>
              <div className="flex items-center gap-4 relative">
                <div>
                  <p className="text-xs text-[#A5B4FC]">Pending escrow</p>
                  <p className="text-sm font-semibold text-white tabular-nums">${held.toFixed(2)}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div>
                  <p className="text-xs text-[#A5B4FC]">This month</p>
                  <p className="text-sm font-semibold text-white tabular-nums">${thisMonth.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Withdraw */}
            {withdrawError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4">
                {withdrawError}
              </div>
            )}
            {withdrawn ? (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 mb-5 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Payment sent to your wallet</p>
                  <p className="text-xs text-emerald-600">Your USDC will arrive shortly</p>
                </div>
              </div>
            ) : !walletConnected ? (
              <div className="mb-5 space-y-2">
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button
                      onClick={show}
                      className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 bg-[#0F172A] hover:bg-[#1E293B] text-white transition-all"
                    >
                      <Wallet size={18} />
                      Connect wallet to withdraw
                    </button>
                  )}
                </ConnectKitButton.Custom>
                <p className="text-center text-xs text-[#64748B]">Connect a wallet to receive your USDC earnings</p>
              </div>
            ) : (
              <div className="mb-5 space-y-2">
                <div className="bg-[#F8FAFC] rounded-2xl p-3 flex items-center gap-2 text-xs text-[#64748B]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-medium text-[#0F172A]">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                  <span className="ml-auto">Receiving wallet</span>
                </div>
                <button
                  onClick={() => { void handleWithdraw() }}
                  disabled={withdrawing || available <= 0}
                  className={`w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
                    withdrawing || available <= 0 ? 'bg-[#A5B4FC] cursor-not-allowed' : 'bg-[#0F172A] hover:bg-[#1E293B]'
                  } text-white`}
                >
                  {withdrawing ? (
                    <><Loader2 size={18} className="animate-spin" />Sending to wallet...</>
                  ) : (
                    <><DollarSign size={18} />Withdraw ${available.toFixed(2)}</>
                  )}
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { icon: DollarSign, label: 'Total earned', value: `$${summary?.totalEarned?.toFixed(2) ?? '0.00'}`, sub: 'All time', color: '#6366F1' },
                { icon: TrendingUp, label: 'Referral income', value: `$${referralEarnings.toFixed(2)}`, sub: 'Active referrals', color: '#059669' },
                { icon: Clock, label: 'Minutes booked', value: `${summary?.minutesBooked ?? 0}`, sub: 'This month', color: '#F59E0B' },
                { icon: Users, label: 'Total calls', value: String(totalCalls), sub: 'Completed', color: '#8B5CF6' },
              ].map(({ icon: Icon, label, value, sub, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: color + '15' }}>
                    <Icon size={16} style={{ color }} />
                  </div>
                  <p className="text-xl font-bold text-[#0F172A] tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
                  <p className="text-xs text-[#64748B]">{label}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Last 7 days chart */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
              <h2 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Last 7 days</h2>
              <div className="flex items-end gap-2 h-24">
                {last7.map((val, i) => {
                  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
                  const maxVal = Math.max(...last7, 1)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div
                        className={`w-full rounded-lg transition-all ${val > 0 ? 'bg-[#6366F1]' : 'bg-gray-100'}`}
                        style={{ height: `${(val / maxVal) * 72}px`, minHeight: '4px' }}
                      />
                      <span className="text-xs text-[#64748B]">{days[i]}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Transaction history */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Transaction history</h2>
                <span className="text-xs text-[#64748B]">{transactions.length} transactions</span>
              </div>
              <div className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <div className="px-5 py-8 text-center text-sm text-[#64748B]">No transactions yet</div>
                ) : (
                  transactions.map((entry) => (
                    <div key={entry.id} className="px-5 py-4 flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ backgroundColor: entry.guestColor ?? '#6366F1' }}
                      >
                        {entry.guestInitials ?? entry.guest_name?.slice(0, 2).toUpperCase() ?? '??'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{entry.guestName ?? entry.guest_name ?? 'Guest'}</p>
                        <p className="text-xs text-[#64748B]">{entry.date} · {entry.duration} min</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-[#0F172A] tabular-nums">+${(entry.netEarnings ?? entry.host_earnings ?? 0).toFixed(2)}</p>
                        <div className="flex items-center gap-1 justify-end">
                          {(entry.status === 'released' || entry.status === 'completed') ? (
                            <><CheckCircle2 size={10} className="text-emerald-500" /><span className="text-xs text-emerald-600">Released</span></>
                          ) : entry.status === 'pending' ? (
                            <><Loader2 size={10} className="text-[#6366F1] animate-spin" /><span className="text-xs text-[#6366F1]">Pending</span></>
                          ) : (
                            <><AlertCircle size={10} className="text-amber-500" /><span className="text-xs text-amber-600">Disputed</span></>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              onClick={() => onNavigate('invite')}
              className="mt-4 bg-gradient-to-r from-[#6366F1] to-[#818CF8] rounded-2xl p-5 cursor-pointer hover:opacity-95 transition-opacity"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Invite people. Earn 20%.</p>
                  <p className="text-[#A5B4FC] text-xs">Earn 20% of our revenue from every person you invite for 12 months.</p>
                </div>
                <ChevronRight size={20} className="text-white flex-shrink-0" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
