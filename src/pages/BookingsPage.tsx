import type { Page } from '../App'
import { useState, useEffect } from 'react'
import { Video, Mic, Clock, CheckCircle2, XCircle, AlertCircle, ChevronRight, Calendar, Loader2 } from 'lucide-react'
import { bookings as bookingsApi, type Booking } from '../lib/api'
import { MOCK_BOOKINGS } from '../data/mockData'

interface BookingsPageProps {
  onNavigate: (page: Page, username?: string) => void
}

type Tab = 'upcoming' | 'completed' | 'cancelled'

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  upcoming: { label: 'Upcoming', icon: Clock, color: 'text-[#6366F1]', bg: 'bg-[#E0E7FF]' },
  confirmed: { label: 'Upcoming', icon: Clock, color: 'text-[#6366F1]', bg: 'bg-[#E0E7FF]' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  disputed: { label: 'Disputed', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function BookingCard({ booking, onNavigate }: { booking: Booking; onNavigate: (page: Page, username?: string) => void }) {
  const statusKey = booking.status in STATUS_CONFIG ? booking.status : 'upcoming'
  const status = STATUS_CONFIG[statusKey]
  const StatusIcon = status.icon
  const isHost = booking.role === 'host'
  const otherName = isHost ? (booking.guest_name ?? 'Guest') : (booking.host_name ?? 'Host')
  const earnings = isHost ? (booking.host_earnings ?? 0) : (booking.gross_amount ?? 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#6366F1] text-white font-bold flex-shrink-0 text-sm">
          {initials(otherName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[#0F172A] text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {otherName}
            </p>
            {isHost && (
              <span className="text-xs bg-[#E0E7FF] text-[#6366F1] px-2 py-0.5 rounded-lg">You're the host</span>
            )}
          </div>
          <p className="text-xs text-[#64748B]">{booking.call_type === 'video' ? 'Video call' : 'Voice call'} · {booking.duration} min</p>
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${status.bg} flex-shrink-0`}>
          <StatusIcon size={11} className={status.color} />
          <span className={`text-xs font-semibold ${status.color}`}>{status.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          { icon: Calendar, value: `${booking.date} · ${booking.start_time}` },
          { icon: Clock, value: `${booking.duration} min` },
          { icon: booking.call_type === 'video' ? Video : Mic, value: booking.call_type === 'video' ? 'Video call' : 'Voice call' },
        ].map(({ icon: Icon, value }) => (
          <div key={value} className="flex items-center gap-1.5 text-xs text-[#64748B]">
            <Icon size={12} className="text-[#6366F1]" />
            {value}
          </div>
        ))}
      </div>

      {booking.topic && (
        <div className="bg-[#F8FAFC] rounded-xl p-3 mb-4">
          <p className="text-xs text-[#64748B] line-clamp-2">{booking.topic}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 text-xs text-[#64748B]">
        <span>
          {isHost ? 'You earn' : 'You paid'}:{' '}
          <span className="font-bold text-[#0F172A] tabular-nums">${earnings.toFixed(2)}</span>
        </span>
        {isHost && (booking.status === 'completed') && (
          <span className="text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 size={11} />Paid out
          </span>
        )}
        {(booking.status === 'upcoming' || booking.status === 'confirmed') && (
          <span className="text-[#64748B]">Held in escrow</span>
        )}
      </div>

      <div className="flex gap-2">
        {(booking.status === 'upcoming' || booking.status === 'confirmed') && (
          <button
            onClick={() => onNavigate('call', booking.id)}
            className="flex-1 bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3 rounded-xl text-sm transition-all"
          >
            Join call
          </button>
        )}
        {(booking.status === 'upcoming' || booking.status === 'confirmed') && (
          <button
            onClick={() => {
              void bookingsApi.cancel(booking.id).catch(() => {})
            }}
            className="flex-1 bg-white border border-gray-200 text-[#64748B] font-medium py-3 rounded-xl text-sm hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
          >
            Cancel
          </button>
        )}
        {booking.status === 'completed' && (
          <button
            onClick={() => onNavigate('discover')}
            className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-[#0F172A] font-medium py-3 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
          >
            Book again <ChevronRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

// Adapt mock data shape to API Booking shape for fallback display
function mockToBooking(m: (typeof MOCK_BOOKINGS)[0]): Booking {
  return {
    id: m.id,
    guest_user_id: '',
    host_user_id: '',
    host_profile_id: '',
    date: m.date,
    start_time: m.time,
    end_time: '',
    duration: m.duration,
    call_type: m.callType,
    topic: m.topic,
    guest_name: m.role === 'host' ? m.personName : undefined,
    host_name: m.role === 'guest' ? m.personName : undefined,
    status: m.status === 'upcoming' ? 'confirmed' : m.status,
    gross_amount: m.totalPaid ?? 0,
    platform_fee: 0,
    host_earnings: m.hostEarnings ?? 0,
    role: m.role,
  }
}

export function BookingsPage({ onNavigate }: BookingsPageProps) {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    bookingsApi.list()
      .then((res) => { if (!cancelled) setBookings(res.bookings) })
      .catch(() => {
        // Fall back to mock data for demo
        if (!cancelled) setBookings(MOCK_BOOKINGS.map(mockToBooking))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = bookings.filter((b) => {
    if (tab === 'upcoming') return b.status === 'upcoming' || b.status === 'confirmed'
    if (tab === 'completed') return b.status === 'completed'
    return b.status === 'cancelled' || b.status === 'disputed'
  })

  const counts = {
    upcoming: bookings.filter((b) => b.status === 'upcoming' || b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled' || b.status === 'disputed').length,
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Bookings
          </h1>
          <p className="text-sm text-[#64748B]">All your calls in one place</p>
        </div>

        <div className="flex gap-2 mb-6">
          {(['upcoming', 'completed', 'cancelled'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors capitalize ${
                tab === t
                  ? 'bg-[#6366F1] text-white'
                  : 'bg-white border border-gray-200 text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]'
              }`}
            >
              {t}
              {counts[t] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${tab === t ? 'bg-white/20 text-white' : 'bg-[#E0E7FF] text-[#6366F1]'}`}>
                  {counts[t]}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-[#6366F1]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#E0E7FF] flex items-center justify-center mx-auto mb-4">
              <Calendar size={28} className="text-[#6366F1]" />
            </div>
            <p className="font-bold text-[#0F172A] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              No {tab} bookings
            </p>
            <p className="text-sm text-[#64748B] mb-4">
              {tab === 'upcoming' ? 'Book a call with someone to get started' : 'Your call history will appear here'}
            </p>
            {tab === 'upcoming' && (
              <button
                onClick={() => onNavigate('discover')}
                className="bg-[#6366F1] text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-[#4F46E5] transition-colors"
              >
                Discover people
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onNavigate={onNavigate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
