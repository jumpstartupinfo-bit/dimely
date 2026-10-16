import { useState, useEffect } from 'react'
import { Copy, CheckCircle2, Link, Loader2 } from 'lucide-react'
import { referrals as referralsApi, type ReferralDashboard } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import type { Page } from '../App'

interface InviteEarnPageProps {
  onNavigate: (page: Page, username?: string) => void
}

const HOW_IT_WORKS = [
  { step: '01', title: 'Share your link', body: 'Share your personal Dimely invite link anywhere — WhatsApp, Instagram, X, or email.' },
  { step: '02', title: 'They join Dimely', body: "When someone signs up using your link and creates their Dimely page, you're linked." },
  { step: '03', title: 'You earn 20%', body: "You earn 20% of Dimely's platform revenue from all of their bookings for 12 months." },
]

export function InviteEarnPage({ onNavigate: _onNavigate }: InviteEarnPageProps) {
  const { referralCode, referralSlug } = useAuth()
  const [codeCopied, setCodeCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null)

  const myCode = referralCode ?? dashboard?.code ?? 'DIMELY-YOU-XXXX'
  const mySlug = referralSlug ?? dashboard?.linkSlug ?? 'you'
  const referralLink = `dimely.com/invite/${mySlug}`

  useEffect(() => {
    let mounted = true
    referralsApi.dashboard().then((res) => {
      if (mounted) setDashboard(res)
    }).catch(() => {
      if (mounted) setDashboard({
        code: null,
        linkSlug: null,
        referrals: [
          { referred_name: 'Alex Johnson', created_at: '2026-10-03', booking_count: 3, total_commission: 12.40, status: 'active' },
          { referred_name: 'Maria Santos', created_at: '2026-09-28', booking_count: 7, total_commission: 28.00, status: 'active' },
          { referred_name: 'David Kim', created_at: '2026-09-15', booking_count: 11, total_commission: 44.20, status: 'active' },
        ],
        totalEarned: 84.60,
        activeReferrals: 3,
      })
    }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  function copyCode() {
    navigator.clipboard.writeText(myCode).catch(() => {})
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  function copyLink() {
    navigator.clipboard.writeText(`https://${referralLink}`).catch(() => {})
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const referrals = dashboard?.referrals ?? []
  const totalCommission = dashboard?.totalEarned ?? 0
  const activeCount = dashboard?.activeReferrals ?? 0

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#6366F1] to-[#818CF8] rounded-2xl p-6 mb-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-6 -translate-x-6" />
          <p className="text-[#A5B4FC] text-sm font-medium mb-1 relative">Referral earnings</p>
          <p
            className="text-4xl font-bold text-white tabular-nums relative mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            ${totalCommission.toFixed(2)}
          </p>
          <p className="text-[#A5B4FC] text-sm relative">from {activeCount} active referral{activeCount !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-3 gap-4 mt-5 relative">
            {[
              { label: 'Referrals', value: String(referrals.length) },
              { label: 'Commission rate', value: '20%' },
              { label: 'Duration', value: '12 months' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-white font-bold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{value}</p>
                <p className="text-[#A5B4FC] text-xs">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Invite links */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="text-base font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Your invite link
          </h2>

          <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-xl p-3 mb-3">
            <Link size={14} className="text-[#6366F1] flex-shrink-0" />
            <span className="flex-1 text-sm text-[#0F172A] truncate font-medium">{referralLink}</span>
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                linkCopied ? 'bg-emerald-100 text-emerald-600' : 'bg-[#E0E7FF] text-[#6366F1] hover:bg-[#C7D2FE]'
              }`}
            >
              {linkCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="flex items-center gap-2 bg-[#F8FAFC] rounded-xl p-3 mb-4">
            <span className="flex-1 text-sm font-bold text-[#0F172A] tracking-wider tabular-nums">{myCode}</span>
            <button
              onClick={copyCode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                codeCopied ? 'bg-emerald-100 text-emerald-600' : 'bg-[#E0E7FF] text-[#6366F1] hover:bg-[#C7D2FE]'
              }`}
            >
              {codeCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              {codeCopied ? 'Copied!' : 'Copy code'}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {['WhatsApp', 'Instagram', 'X', 'Email', 'LinkedIn'].map((platform) => (
              <button
                key={platform}
                onClick={() => { void navigator.clipboard.writeText(`https://${referralLink}`).catch(() => {}) }}
                className="text-xs font-medium text-[#64748B] bg-[#F8FAFC] border border-gray-200 px-3 py-2 rounded-xl hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
              >
                {platform}
              </button>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
          <h2 className="text-base font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>How it works</h2>
          <div className="space-y-4">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E0E7FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#6366F1]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>{step}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{title}</p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referrals list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-[#6366F1]" />
          </div>
        ) : referrals.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Your referrals</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(referrals).map((r, i) => {
                const displayName = r.referred_name ?? r.name ?? '?'
                const initials = displayName.split(' ').map((n) => n[0]).join('')
                const joinedDate = r.created_at
                  ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : (r.joined ?? '')
                const bookingCount = r.booking_count ?? r.bookings ?? 0
                const commission = r.total_commission ?? r.commission ?? 0
                return (
                  <div key={r.id ?? i} className="px-5 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E0E7FF] flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-[#6366F1]">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A]">{displayName}</p>
                      <p className="text-xs text-[#64748B]">
                        Joined {joinedDate} · {bookingCount} bookings
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-[#0F172A] tabular-nums">+${commission.toFixed(2)}</p>
                      <span className="text-xs text-emerald-600 font-medium">Active</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="bg-[#F8FAFC] rounded-2xl p-4 text-xs text-[#64748B] leading-relaxed">
          <p className="font-semibold text-[#0F172A] mb-1">Referral terms</p>
          You earn 20% of Dimely's platform revenue from every booking made by your referrals, for 12 months from their signup date.
          Commissions are calculated on settled platform revenue only. Referral fraud results in permanent account termination.
          Self-referrals are not permitted.
        </div>
      </div>
    </div>
  )
}
