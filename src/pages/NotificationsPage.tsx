import { useState, useEffect } from 'react'
import {
  Bell,
  Calendar,
  CheckCircle2,
  XCircle,
  DollarSign,
  UserPlus,
  Bot,
  Zap,
  RefreshCcw,
  Loader2,
} from 'lucide-react'
import { notifications as notifApi, type AppNotification } from '../lib/api'
import { MOCK_NOTIFICATIONS } from '../data/mockData'
import type { Page } from '../App'

interface NotificationsPageProps {
  onNavigate: (page: Page, username?: string) => void
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const TYPE_ICON: Record<string, React.ElementType> = {
  new_booking: Calendar,
  booking_confirmed: CheckCircle2,
  booking_cancelled: XCircle,
  reminder: Bell,
  starting_soon: Zap,
  call_completed: CheckCircle2,
  payment_released: DollarSign,
  refund: RefreshCcw,
  referral_signup: UserPlus,
  referral_earnings: DollarSign,
  ai_activity: Bot,
}

const TYPE_COLOR: Record<string, string> = {
  new_booking: '#6366F1',
  booking_confirmed: '#059669',
  booking_cancelled: '#DC2626',
  reminder: '#F59E0B',
  starting_soon: '#F59E0B',
  call_completed: '#059669',
  payment_released: '#059669',
  refund: '#64748B',
  referral_signup: '#6366F1',
  referral_earnings: '#059669',
  ai_activity: '#0891B2',
}

export function NotificationsPage({ onNavigate: _onNavigate }: NotificationsPageProps) {
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    notifApi.list().then((res) => {
      if (mounted) setNotifs(res.notifications)
    }).catch(() => {
      if (mounted) setNotifs(MOCK_NOTIFICATIONS)
    }).finally(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  function markAllRead() {
    void notifApi.markAllRead().catch(() => {})
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  function markRead(id: string) {
    void notifApi.markRead(id).catch(() => {})
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n))
  }

  const unreadCount = notifs.filter((n) => !n.read).length

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Notifications</h1>
            {unreadCount > 0 && <p className="text-sm text-[#64748B]">{unreadCount} unread</p>}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-semibold text-[#6366F1] hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : notifs.length === 0 ? (
          <div className="text-center py-20">
            <Bell size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-[#64748B]">No notifications yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-50">
              {notifs.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell
                const color = TYPE_COLOR[n.type] ?? '#6366F1'
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full flex items-start gap-4 px-5 py-4 text-left transition-colors ${
                      !n.read ? 'bg-[#F8FAFC]' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: color + '15' }}
                    >
                      <Icon size={18} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold ${!n.read ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full bg-[#6366F1] flex-shrink-0 mt-1.5" />}
                      </div>
                      <p className="text-sm text-[#64748B] mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-xs text-[#94A3B8] mt-1">{timeAgo(n.timestamp ?? n.created_at ?? '')}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
