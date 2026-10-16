import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Users, BookOpen, CreditCard, AlertTriangle,
  Settings, RefreshCw, Search, CheckCircle2, XCircle, Loader2,
  Shield, ChevronRight, AlertCircle,
  Ban, RotateCcw, ExternalLink,
} from 'lucide-react'
import {
  admin as adminApi,
  type AdminStats, type AdminUser, type AdminBooking,
  type AdminDispute, type AdminPayment,
} from '../lib/api'
import { buildTxExplorerUrl } from '@/onchain-facts'
import type { Page } from '../App'

interface AdminDashboardProps {
  onNavigate: (page: Page) => void
}

type AdminTab = 'overview' | 'users' | 'bookings' | 'payments' | 'disputes' | 'settings'

const ARC_TESTNET_CHAIN_ID = 5042002

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = '#6366F1' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-[#0F172A] tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif", color }}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#64748B] mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: 'bg-emerald-50 text-emerald-700',
    confirmed: 'bg-emerald-50 text-emerald-700',
    released: 'bg-emerald-50 text-emerald-700',
    paid: 'bg-emerald-50 text-emerald-700',
    active: 'bg-emerald-50 text-emerald-700',
    pending: 'bg-amber-50 text-amber-700',
    processing: 'bg-blue-50 text-blue-700',
    escrowed: 'bg-blue-50 text-blue-700',
    held: 'bg-blue-50 text-blue-700',
    verifying: 'bg-blue-50 text-blue-700',
    cancelled: 'bg-gray-100 text-[#64748B]',
    refunded: 'bg-gray-100 text-[#64748B]',
    failed: 'bg-red-50 text-red-700',
    disputed: 'bg-red-50 text-red-700',
    open: 'bg-red-50 text-red-700',
    suspended: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${map[status] ?? 'bg-gray-100 text-[#64748B]'}`}>
      {status}
    </span>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function OverviewTab({ stats }: { stats: AdminStats }) {
  const { users, marketplace, financial, growth, ai } = stats
  return (
    <div className="space-y-6">
      {/* Users */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">Users</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total users" value={users.total} />
          <StatCard label="New this month" value={users.newThisMonth} color="#059669" />
          <StatCard label="Active hosts" value={users.hosts} color="#8B5CF6" />
        </div>
      </div>

      {/* Marketplace */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">Marketplace</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Published profiles" value={marketplace.publishedProfiles} sub={`${marketplace.totalProfiles} total`} />
          <StatCard label="Total bookings" value={marketplace.totalBookings} />
          <StatCard label="Completed" value={marketplace.completedBookings} color="#059669" />
          <StatCard label="In escrow" value={marketplace.inEscrowCount} color="#F59E0B" />
        </div>
      </div>

      {/* Financial */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">Financial</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Gross volume" value={`$${financial.grossVolume.toFixed(2)}`} color="#6366F1" />
          <StatCard label="Platform revenue" value={`$${financial.platformRevenue.toFixed(2)}`} color="#6366F1" />
          <StatCard label="Host earnings" value={`$${financial.hostEarnings.toFixed(2)}`} color="#059669" />
          <StatCard label="Held in escrow" value={`$${financial.heldEscrow.toFixed(2)}`} color="#F59E0B" />
          <StatCard label="Total refunds" value={`$${financial.totalRefunds.toFixed(2)}`} color="#EF4444" />
          <StatCard label="Withdrawals" value={`$${financial.withdrawalsTotal.toFixed(2)}`} sub={`${financial.withdrawalsCount} transfers`} />
          <StatCard label="Disputes" value={marketplace.disputedBookings} color={marketplace.disputedBookings > 0 ? '#EF4444' : '#64748B'} />
          <StatCard label="Cancellations" value={marketplace.cancelledBookings} />
        </div>
      </div>

      {/* Growth */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">Growth</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard label="Total referrals" value={growth.totalReferrals} />
          <StatCard label="Active referrals" value={growth.activeReferrals} color="#059669" />
          <StatCard label="Referral commissions" value={`$${growth.referralCommissions.toFixed(2)}`} color="#8B5CF6" />
        </div>
      </div>

      {/* AI */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">AI Agents</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Active agents" value={ai.activeAgents} color="#6366F1" />
          <StatCard label="Activity this month" value={ai.activityThisMonth} />
        </div>
      </div>
    </div>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const load = useCallback(async (query: string) => {
    setLoading(true)
    try {
      const res = await adminApi.users(query || undefined)
      setUsers(res.users)
      setTotal(res.total)
    } catch { setUsers([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { void load(q) }, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [q, load])

  async function suspend(id: string) {
    try { await adminApi.suspendUser(id, 'Admin action'); setActionMsg('User suspended'); void load(q) }
    catch (e) { setActionMsg(e instanceof Error ? e.message : 'Error') }
  }
  async function restore(id: string) {
    try { await adminApi.restoreUser(id); setActionMsg('User restored'); void load(q) }
    catch (e) { setActionMsg(e instanceof Error ? e.message : 'Error') }
  }
  async function verify(id: string) {
    try { await adminApi.verifyUser(id); setActionMsg('Profile verified'); void load(q) }
    catch (e) { setActionMsg(e instanceof Error ? e.message : 'Error') }
  }

  return (
    <div>
      {actionMsg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} /> {actionMsg}
          <button onClick={() => setActionMsg(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><XCircle size={14} /></button>
        </div>
      )}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
        <input
          type="text" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email or username..."
          className="w-full bg-white border border-gray-200 pl-9 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
        />
      </div>
      <p className="text-xs text-[#64748B] mb-3">{total} users</p>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <p className="text-center text-sm text-[#64748B] py-8">No users found</p>
            ) : users.map((u) => (
              <div key={u.id} className="px-5 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E0E7FF] flex items-center justify-center text-[#6366F1] font-bold text-xs flex-shrink-0">
                  {u.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{u.name}</p>
                  <p className="text-xs text-[#64748B] truncate">{u.email} · @{u.username}</p>
                  {u.headline && <p className="text-xs text-[#64748B] truncate">{u.headline}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge status={u.role} />
                  {u.verified === 1 && <CheckCircle2 size={13} className="text-[#6366F1]" />}
                  {u.role !== 'suspended' ? (
                    <button onClick={() => { void suspend(u.id) }} title="Suspend" className="p-1.5 text-[#64748B] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Ban size={14} />
                    </button>
                  ) : (
                    <button onClick={() => { void restore(u.id) }} title="Restore" className="p-1.5 text-[#64748B] hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                      <RotateCcw size={14} />
                    </button>
                  )}
                  {!u.verified && (
                    <button onClick={() => { void verify(u.id) }} title="Verify" className="p-1.5 text-[#64748B] hover:text-[#6366F1] hover:bg-[#E0E7FF] rounded-lg transition-colors">
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Bookings tab ─────────────────────────────────────────────────────────────
function BookingsTab() {
  const [bookings, setBookings] = useState<AdminBooking[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (status: string) => {
    setLoading(true)
    try {
      const res = await adminApi.bookings(status || undefined)
      setBookings(res.bookings)
    } catch { setBookings([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { async function init() { await load(filter) }; void init() }, [filter, load])

  const FILTERS = ['', 'pending', 'payment_pending', 'confirmed', 'completed', 'cancelled', 'disputed']

  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTERS.map((f) => (
          <button key={f || 'all'} onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${filter === f ? 'bg-[#6366F1] text-white' : 'bg-white border border-gray-200 text-[#64748B] hover:border-[#6366F1]'}`}>
            {f || 'All'}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {bookings.length === 0 ? (
              <p className="text-center text-sm text-[#64748B] py-8">No bookings</p>
            ) : bookings.map((b) => (
              <div key={b.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">{b.guest_name_resolved} → {b.host_name_resolved}</p>
                    <p className="text-xs text-[#64748B]">{b.date} · {b.start_time} · {b.duration}min · {b.call_type}</p>
                    <p className="text-xs text-[#64748B] font-mono mt-0.5 truncate">#{b.id.slice(0, 12)}...</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[#0F172A] tabular-nums">${b.gross_amount}</p>
                    <p className="text-xs text-[#64748B]">Host: ${b.host_earnings}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge status={b.status} />
                  {b.escrow_status && <Badge status={b.escrow_status} />}
                  {b.payment_status && <Badge status={b.payment_status} />}
                  {b.tx_hash && (
                    <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, b.tx_hash as `0x${string}`)} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#6366F1] flex items-center gap-1 hover:underline ml-auto">
                      <ExternalLink size={11} /> Tx
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payments tab ─────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments] = useState<AdminPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try { const res = await adminApi.payments(); setPayments(res.payments) }
      catch { setPayments([]) } finally { setLoading(false) }
    }
    void load()
  }, [])

  return (
    <div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-100">
            {payments.length === 0 ? (
              <p className="text-center text-sm text-[#64748B] py-8">No payments yet</p>
            ) : payments.map((p) => (
              <div key={p.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">{p.payer_name} → {p.host_name}</p>
                    <p className="text-xs text-[#64748B]">Gross: ${p.gross_amount} · Fee: ${p.platform_fee} · Host: ${p.host_earnings}</p>
                    {p.tx_hash && (
                      <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, p.tx_hash as `0x${string}`)} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-[#6366F1] flex items-center gap-1 mt-0.5 hover:underline">
                        <ExternalLink size={10} /> {p.tx_hash.slice(0, 18)}...
                      </a>
                    )}
                    <p className="text-xs text-[#64748B] mt-0.5">{new Date(p.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge status={p.status} />
                    {p.escrow_status && <Badge status={p.escrow_status} />}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Disputes tab ─────────────────────────────────────────────────────────────
function DisputesTab() {
  const [disputes, setDisputes] = useState<AdminDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { const res = await adminApi.disputes(); setDisputes(res.disputes) }
    catch { setDisputes([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { async function init() { await load() }; void init() }, [load])

  async function resolve(id: string, refundGuest: boolean) {
    setResolving(id)
    try {
      await adminApi.resolveDispute(id, {
        resolution: refundGuest ? 'refunded' : 'released',
        refundGuest,
        releaseToHost: !refundGuest,
        note: refundGuest ? 'Admin: refund issued' : 'Admin: released to host',
      })
      setMsg(refundGuest ? 'Refund issued to guest' : 'Funds released to host')
      await load()
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Error') }
    finally { setResolving(null) }
  }

  return (
    <div>
      {msg && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} /> {msg}
          <button onClick={() => setMsg(null)} className="ml-auto"><XCircle size={14} /></button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>
      ) : disputes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 py-12 text-center">
          <Shield size={32} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#0F172A] mb-1">No open disputes</p>
          <p className="text-xs text-[#64748B]">All disputes have been resolved</p>
        </div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d) => (
            <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{d.guest_name} vs {d.host_name}</p>
                  <p className="text-xs text-[#64748B]">Booking: #{d.booking_id.slice(0, 10)}... · ${d.gross_amount}</p>
                  <p className="text-xs text-[#64748B] mt-0.5">{new Date(d.created_at).toLocaleString()}</p>
                </div>
                <Badge status={d.status} />
              </div>
              <div className="bg-[#F8FAFC] rounded-xl p-3 mb-3">
                <p className="text-xs font-semibold text-[#64748B] mb-1">Reason</p>
                <p className="text-sm text-[#0F172A]">{d.reason}</p>
                {d.details && <p className="text-xs text-[#64748B] mt-1">{d.details}</p>}
              </div>
              {d.status === 'open' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => { void resolve(d.id, true) }}
                    disabled={resolving === d.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {resolving === d.id ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Refund guest'}
                  </button>
                  <button
                    onClick={() => { void resolve(d.id, false) }}
                    disabled={resolving === d.id}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                  >
                    Release to host
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Settings tab ─────────────────────────────────────────────────────────────
function SettingsTab() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      try { const res = await adminApi.config(); setConfig(res.config); setDraft(res.config) }
      catch { /* non-fatal */ } finally { setLoading(false) }
    }
    void load()
  }, [])

  async function save() {
    setSaving(true); setSaved(false)
    try {
      await adminApi.updateConfig(draft)
      setConfig(draft)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { /* show nothing — errors surfaced via UI */ } finally { setSaving(false) }
  }

  const fields: { key: string; label: string; type: 'number' | 'text' | 'toggle'; hint?: string }[] = [
    { key: 'platform_fee_percent', label: 'Platform fee (%)', type: 'number', hint: 'Applied to every booking. Default: 20.' },
    { key: 'referral_commission_percent', label: 'Referral commission (%)', type: 'number', hint: '% of platform revenue paid to referrer. Default: 20.' },
    { key: 'referral_duration_months', label: 'Referral duration (months)', type: 'number', hint: 'How long referral commissions last. Default: 12.' },
    { key: 'invite_only', label: 'Invite-only mode', type: 'toggle', hint: 'Restrict signup to invite codes only.' },
  ]

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#6366F1]" /></div>

  return (
    <div>
      {saved && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-2xl px-4 py-3 mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} /> Settings saved
        </div>
      )}
      <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
        {fields.map(({ key, label, type, hint }) => (
          <div key={key} className="px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
              {hint && <p className="text-xs text-[#64748B] mt-0.5">{hint}</p>}
            </div>
            {type === 'toggle' ? (
              <button
                onClick={() => setDraft((d) => ({ ...d, [key]: d[key] === 'true' ? 'false' : 'true' }))}
                className={`relative w-11 h-6 rounded-full transition-colors ${draft[key] === 'true' ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft[key] === 'true' ? 'translate-x-5' : ''}`} />
              </button>
            ) : (
              <input
                type="number"
                value={draft[key] ?? config[key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                className="w-24 text-right bg-[#F8FAFC] border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              />
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => { void save() }}
        disabled={saving}
        className="w-full mt-4 py-3.5 rounded-2xl text-sm font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
      >
        {saving ? <><Loader2 size={16} className="animate-spin" />Saving...</> : 'Save settings'}
      </button>
      <p className="text-center text-xs text-[#64748B] mt-2">
        Financial setting changes are audited. Effective immediately on save.
      </p>
    </div>
  )
}

// ─── Main AdminDashboard ──────────────────────────────────────────────────────
export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('overview')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try { setStats(await adminApi.stats()) }
    catch (e) { setStatsError(e instanceof Error ? e.message : 'Failed to load stats') }
    finally { setStatsLoading(false) }
  }, [])

  useEffect(() => { async function init() { await loadStats() }; void init() }, [loadStats])

  const TABS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'bookings', label: 'Bookings', icon: BookOpen },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Admin top bar */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between py-4 mb-0">
            <div>
              <h1 className="text-xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Admin
              </h1>
              <p className="text-xs text-[#64748B]">Dimely Platform Dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5">
                <Shield size={12} className="text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">Admin only</span>
              </div>
              <button
                onClick={() => { void loadStats() }}
                className="p-2 text-[#64748B] hover:text-[#0F172A] hover:bg-gray-100 rounded-xl transition-colors"
                title="Refresh"
              >
                <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => onNavigate('discover')}
                className="text-xs text-[#64748B] hover:text-[#6366F1] flex items-center gap-1"
              >
                <ChevronRight size={14} />Exit
              </button>
            </div>
          </div>
          {/* Tab bar */}
          <div className="flex gap-0 overflow-x-auto scrollbar-none -mx-4 px-4">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === id ? 'border-[#6366F1] text-[#6366F1]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Overview tab stats error */}
        {tab === 'overview' && statsError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Failed to load stats</p>
              <p className="text-xs text-red-600">{statsError}</p>
            </div>
            <button onClick={() => { void loadStats() }} className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {tab === 'overview' && statsLoading && (
          <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-[#6366F1]" /></div>
        )}

        {tab === 'overview' && !statsLoading && stats && <OverviewTab stats={stats} />}

        {tab === 'users' && <UsersTab />}
        {tab === 'bookings' && <BookingsTab />}
        {tab === 'payments' && <PaymentsTab />}
        {tab === 'disputes' && <DisputesTab />}
        {tab === 'settings' && <SettingsTab />}
      </div>
    </div>
  )
}
