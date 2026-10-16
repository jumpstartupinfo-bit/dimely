import type { Page } from '../App'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Video, Mic } from 'lucide-react'
import { bookings as bookingsApi, availability as availabilityApi, type Booking } from '../lib/api'
import { MOCK_BOOKINGS } from '../data/mockData'



interface CalendarPageProps {
  onNavigate: (page: Page, username?: string) => void
}

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const AVAILABILITY_SLOTS = [
  { day: 'Monday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
  { day: 'Tuesday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
  { day: 'Wednesday', enabled: true, start: '10:00 AM', end: '6:00 PM' },
  { day: 'Thursday', enabled: true, start: '9:00 AM', end: '5:00 PM' },
  { day: 'Friday', enabled: false, start: '9:00 AM', end: '3:00 PM' },
  { day: 'Saturday', enabled: false, start: '10:00 AM', end: '2:00 PM' },
  { day: 'Sunday', enabled: false, start: '10:00 AM', end: '2:00 PM' },
]

const CURRENT_WEEK = [6, 7, 8, 9, 10, 11, 12]
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
// Stable reference computed once at module load — safe to use in render
const TODAY_DATE = new Date().getDate()

// Adapt mock booking for display when API unavailable
function mockAsBooking(m: (typeof MOCK_BOOKINGS)[0]): Booking {
  return {
    id: m.id, guest_user_id: '', host_user_id: '', host_profile_id: '',
    date: m.date, start_time: m.time, end_time: '',
    duration: m.duration, call_type: m.callType, topic: m.topic,
    guest_name: m.role === 'host' ? m.personName : undefined,
    host_name: m.role === 'guest' ? m.personName : undefined,
    status: m.status === 'upcoming' ? 'confirmed' : m.status,
    gross_amount: m.totalPaid ?? 0, platform_fee: 0, host_earnings: m.hostEarnings ?? 0,
    role: m.role,
    personColor: m.personColor, personInitials: m.personInitials,
  } as Booking & { personColor: string; personInitials: string }
}

export function CalendarPage({ onNavigate }: CalendarPageProps) {
  const [view, setView] = useState<'week' | 'month' | 'availability'>('week')
  const [availability, setAvailability] = useState(AVAILABILITY_SLOTS)
  const todayDate = TODAY_DATE
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])

  useEffect(() => {
    let cancelled = false
    bookingsApi.list()
      .then((res) => {
        if (!cancelled) {
          setUpcomingBookings(res.bookings.filter((b) => b.status === 'confirmed' || b.status === 'upcoming'))
        }
      })
      .catch(() => {
        if (!cancelled) setUpcomingBookings(MOCK_BOOKINGS.filter((b) => b.status === 'upcoming').map(mockAsBooking))
      })
    return () => { cancelled = true }
  }, [])

  // Sync availability windows from server
  useEffect(() => {
    let cancelled = false
    availabilityApi.get()
      .then((res) => {
        if (!cancelled && res.windows.length > 0) {
          // Map server windows back to display format (best-effort)
        }
      })
      .catch(() => { /* keep defaults */ })
    return () => { cancelled = true }
  }, [])

  function toggleDay(day: string) {
    setAvailability((prev) =>
      prev.map((d) => (d.day === day ? { ...d, enabled: !d.enabled } : d))
    )
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Calendar
            </h1>
            <p className="text-sm text-[#64748B]">October 2026</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex bg-white border border-gray-200 rounded-xl p-1">
              {(['week', 'month', 'availability'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                    view === v ? 'bg-[#6366F1] text-white' : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  {v === 'availability' ? 'Hours' : v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Week view */}
        {view === 'week' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <button className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 transition-colors">
                <ChevronLeft size={18} className="text-[#64748B]" />
              </button>
              <p className="text-sm font-semibold text-[#0F172A]">Oct 6 – 12, 2026</p>
              <button className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 transition-colors">
                <ChevronRight size={18} className="text-[#64748B]" />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAYS_OF_WEEK.map((d, i) => {
                  const date = CURRENT_WEEK[i]
                  const isToday = date === todayDate
                  return (
                    <div key={d} className={`py-3 text-center ${isToday ? 'bg-[#E0E7FF]' : ''}`}>
                      <p className="text-xs text-[#64748B] font-medium">{d}</p>
                      <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>
                        {date}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Time grid */}
              <div className="relative min-h-[320px] p-4">
                {/* Booking events */}
                {upcomingBookings.map((booking, idx) => {
                  const isHost = booking.role === 'host'
                  const otherName = isHost ? (booking.guest_name ?? 'Guest') : (booking.host_name ?? 'Host')
                  return (
                    <div
                      key={booking.id}
                      onClick={() => onNavigate('bookings')}
                      className={`absolute rounded-xl p-2.5 cursor-pointer hover:opacity-90 transition-opacity ${
                        isHost ? 'bg-[#6366F1] text-white' : 'bg-[#E0E7FF] text-[#6366F1]'
                      }`}
                      style={{
                        left: `${((idx % 5) / 7) * 100}%`,
                        width: `${(1 / 7) * 100 - 2}%`,
                        top: `${20 + idx * 60}px`,
                      }}
                    >
                      <p className="text-xs font-bold truncate">{otherName.split(' ')[0]}</p>
                      <p className={`text-xs ${isHost ? 'text-[#A5B4FC]' : 'text-[#6366F1]'}`}>{booking.start_time}</p>
                      <p className={`text-xs ${isHost ? 'text-[#A5B4FC]' : 'text-[#6366F1]'}`}>{booking.duration}m</p>
                    </div>
                  )
                })}

                {/* Empty state hint */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                  <p className="text-xs text-[#64748B]">Click a booking to view details</p>
                </div>
              </div>
            </div>

            {/* Upcoming list */}
            <div>
              <h2 className="text-base font-bold text-[#0F172A] mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Upcoming this week
              </h2>
              <div className="space-y-3">
                {upcomingBookings.length === 0 ? (
                  <p className="text-sm text-[#64748B] text-center py-4">No upcoming bookings this week</p>
                ) : upcomingBookings.map((booking) => {
                  const isHost = booking.role === 'host'
                  const otherName = isHost ? (booking.guest_name ?? 'Guest') : (booking.host_name ?? 'Host')
                  const nameInitials = otherName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
                  return (
                    <div
                      key={booking.id}
                      onClick={() => onNavigate('bookings')}
                      className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-[#6366F1]">
                        {nameInitials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-sm text-[#0F172A] truncate">{otherName}</p>
                          {isHost && <span className="text-xs bg-[#E0E7FF] text-[#6366F1] px-2 py-0.5 rounded-lg flex-shrink-0">Host</span>}
                        </div>
                        <p className="text-xs text-[#64748B]">{booking.date} · {booking.start_time} · {booking.duration}min</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1 justify-end mb-1">
                          {booking.call_type === 'video' ? (
                            <Video size={14} className="text-[#6366F1]" />
                          ) : (
                            <Mic size={14} className="text-[#6366F1]" />
                          )}
                          <span className="text-xs text-[#64748B] capitalize">{booking.call_type}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); onNavigate('call', booking.id) }}
                          className="text-xs bg-[#6366F1] text-white px-3 py-1.5 rounded-lg hover:bg-[#4F46E5] transition-colors"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Month view */}
        {view === 'month' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {DAYS_OF_WEEK.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-[#64748B] py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {([null, null] as (string | null)[]).concat(MONTH_DAYS.map(String)).map((d, i) => {
                const date = d ? parseInt(d) : null
                const isToday = date === todayDate
                const hasBooking = date && [9, 10].includes(date)
                return (
                  <div
                    key={i}
                    className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      isToday
                        ? 'bg-[#6366F1] text-white'
                        : hasBooking
                        ? 'bg-[#E0E7FF] text-[#6366F1]'
                        : date
                        ? 'hover:bg-[#F8FAFC] text-[#0F172A]'
                        : ''
                    }`}
                  >
                    {date}
                    {hasBooking && !isToday && <span className="w-1 h-1 rounded-full bg-[#6366F1] mt-0.5" />}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Availability settings */}
        {view === 'availability' && (
          <div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="text-base font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Your working hours
              </h2>
              <p className="text-sm text-[#64748B] mb-5">
                Set when you're available for bookings. People can only book during these hours.
              </p>
              <div className="space-y-4">
                {availability.map((slot) => (
                  <div key={slot.day} className="flex items-center gap-4">
                    <button
                      onClick={() => toggleDay(slot.day)}
                      className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${slot.enabled ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-1 transition-transform ${slot.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <span className={`text-sm font-medium w-24 flex-shrink-0 ${slot.enabled ? 'text-[#0F172A]' : 'text-[#64748B]'}`}>
                      {slot.day}
                    </span>
                    {slot.enabled ? (
                      <div className="flex items-center gap-2 text-sm text-[#64748B]">
                        <span className="bg-[#F8FAFC] px-3 py-1.5 rounded-lg">{slot.start}</span>
                        <span>–</span>
                        <span className="bg-[#F8FAFC] px-3 py-1.5 rounded-lg">{slot.end}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-[#64748B]">Unavailable</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Buffer time */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
              <h2 className="text-sm font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Buffer time between calls
              </h2>
              <p className="text-xs text-[#64748B] mb-3">Give yourself time to reset between bookings</p>
              <div className="flex gap-2">
                {[0, 5, 10, 15, 30].map((m) => (
                  <button
                    key={m}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      m === 10 ? 'bg-[#6366F1] text-white' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                    }`}
                  >
                    {m === 0 ? 'None' : `${m} min`}
                  </button>
                ))}
              </div>
            </div>

            <button className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3.5 rounded-2xl transition-all">
              Save availability
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
