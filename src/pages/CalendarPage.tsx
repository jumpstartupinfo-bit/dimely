import type { Page } from '../App'
import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Video, Mic } from 'lucide-react'
import { bookings as bookingsApi, availability as availabilityApi, type Booking } from '../lib/api'



interface CalendarPageProps {
  onNavigate: (page: Page, username?: string) => void
  initialView?: 'week' | 'month' | 'availability'
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

function formatTime12(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

function minutesOf(t12: string): number {
  const [time, period] = t12.split(' ')
  const [h, m] = time.split(':').map(Number)
  let hour = h
  if (period === 'PM' && h !== 12) hour = h + 12
  if (period === 'AM' && h === 12) hour = 0
  return hour * 60 + m
}

// Every half hour across the whole day. A day can end as late as 11:59 PM.
const START_CHOICES = Array.from({ length: 48 }, (_, i) => formatTime12(i * 30))
const END_CHOICES = [...START_CHOICES.slice(1), '11:59 PM']

// Read once when the page loads. Used for "today" and for what counts as upcoming.
const NOW_AT_LOAD = new Date()

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)) // Monday first
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Bookings are stored in UTC. This is the moment the call starts, shown in the viewer's own time zone. */
function bookingStart(b: Booking): Date {
  return new Date(`${b.date}T${b.start_time}:00Z`)
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' })
}

function weekLabel(start: Date): string {
  const end = addDays(start, 6)
  const left = start.toLocaleDateString([], { month: 'short', day: 'numeric' })
  const right = end.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  return `${left} – ${right}`
}

export function CalendarPage({ onNavigate, initialView = 'week' }: CalendarPageProps) {
  const [view, setView] = useState<'week' | 'month' | 'availability'>(initialView)
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(NOW_AT_LOAD))
  const [monthStart, setMonthStart] = useState<Date>(() => new Date(NOW_AT_LOAD.getFullYear(), NOW_AT_LOAD.getMonth(), 1))
  const [availability, setAvailability] = useState(AVAILABILITY_SLOTS)
  const [bufferMinutes, setBufferMinutes] = useState(10)
  const [savingAvailability, setSavingAvailability] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [upcomingBookings, setUpcomingBookings] = useState<Booking[]>([])

  async function handleSaveAvailability() {
    setSaveSuccess(false)
    setSaveError(null)
    const badDay = availability.find((d) => d.enabled && minutesOf(d.end) <= minutesOf(d.start))
    if (badDay) {
      setSaveError(`${badDay.day}: the end time must be after the start time.`)
      return
    }
    setSavingAvailability(true)
    const DAY_MAP: Record<string, number> = {
      Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 0,
    }
    function to24(t: string): string {
      const [time, period] = t.split(' ')
      const [h, m] = time.split(':').map(Number)
      let hour = h
      if (period === 'PM' && h !== 12) hour = h + 12
      if (period === 'AM' && h === 12) hour = 0
      return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }
    const windows = availability
      .filter((s) => s.enabled)
      .map((s) => ({
        day_of_week: DAY_MAP[s.day],
        start_time: to24(s.start),
        end_time: to24(s.end),
      }))
    try {
      await availabilityApi.setWindows(windows)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save your availability. Please try again.')
    } finally {
      setSavingAvailability(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    bookingsApi.list()
      .then((res) => {
        if (!cancelled) {
          setUpcomingBookings(res.bookings.filter((b) => b.status === 'confirmed' || b.status === 'upcoming'))
        }
      })
      .catch(() => {
        if (!cancelled) setUpcomingBookings([])
      })
    return () => { cancelled = true }
  }, [])

  // Sync availability windows from server
  useEffect(() => {
    let cancelled = false
    function to12(t: string): string {
      const [h, m] = t.split(':').map(Number)
      const period = h >= 12 ? 'PM' : 'AM'
      const hour = h % 12 || 12
      return `${hour}:${String(m).padStart(2,'0')} ${period}`
    }
    availabilityApi.get()
      .then((res) => {
        if (!cancelled && res.windows.length === 0) {
          setAvailability((prev) => prev.map((slot) => ({ ...slot, enabled: false })))
        } else if (!cancelled) {
          setAvailability(AVAILABILITY_SLOTS.map((slot) => {
            const DAY_MAP: Record<string,number> = {Monday:1,Tuesday:2,Wednesday:3,Thursday:4,Friday:5,Saturday:6,Sunday:0}
            const dow = DAY_MAP[slot.day]
            const match = res.windows.find((w) => w.day_of_week === dow)
            if (match) return { ...slot, enabled: true, start: to12(match.start_time), end: to12(match.end_time) }
            return { ...slot, enabled: false }
          }))
        }
      })
      .catch(() => { /* keep defaults */ })
    return () => { cancelled = true }
  }, [])

  function setSlotTime(day: string, field: 'start' | 'end', value: string) {
    setSaveSuccess(false)
    setSaveError(null)
    setAvailability((prev) => prev.map((d) => (d.day === day ? { ...d, [field]: value } : d)))
  }

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
            <p className="text-sm text-[#64748B]">
              {view === 'month' ? monthLabel(monthStart) : view === 'week' ? monthLabel(weekStart) : 'Working hours'}
            </p>
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
        {view === 'week' && (() => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
          const weekBookings = upcomingBookings.filter((bk) => {
            const t = bookingStart(bk)
            return t >= days[0] && t < addDays(days[6], 1)
          })
          const upcomingList = upcomingBookings
            .filter((bk) => bookingStart(bk).getTime() >= NOW_AT_LOAD.getTime() - 60 * 60 * 1000)
            .slice(0, 10)
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setWeekStart((w) => addDays(w, -7))}
                  aria-label="Previous week"
                  className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                >
                  <ChevronLeft size={18} className="text-[#64748B]" />
                </button>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-[#0F172A]">{weekLabel(weekStart)}</p>
                  <button
                    onClick={() => setWeekStart(startOfWeek(NOW_AT_LOAD))}
                    className="text-xs font-semibold text-[#6366F1] bg-[#E0E7FF] hover:bg-[#C7D2FE] px-2.5 py-1 rounded-lg transition-colors"
                  >
                    Today
                  </button>
                </div>
                <button
                  onClick={() => setWeekStart((w) => addDays(w, 7))}
                  aria-label="Next week"
                  className="p-2 rounded-xl hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
                >
                  <ChevronRight size={18} className="text-[#64748B]" />
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6">
                <div className="grid grid-cols-7 divide-x divide-gray-100">
                  {days.map((day, i) => {
                    const isToday = sameDay(day, NOW_AT_LOAD)
                    const dayBookings = weekBookings
                      .filter((bk) => sameDay(bookingStart(bk), day))
                      .sort((x, y) => bookingStart(x).getTime() - bookingStart(y).getTime())
                    return (
                      <div key={day.toISOString()} className="min-h-[260px]">
                        <div className={`py-3 text-center border-b border-gray-100 ${isToday ? 'bg-[#E0E7FF]' : ''}`}>
                          <p className="text-xs text-[#64748B] font-medium">{DAYS_OF_WEEK[i]}</p>
                          <p className={`text-sm font-bold mt-0.5 ${isToday ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>
                            {day.getDate()}
                          </p>
                        </div>
                        <div className="p-1.5 space-y-1.5">
                          {dayBookings.map((booking) => {
                            const isHost = booking.role === 'host'
                            const otherName = isHost ? (booking.guest_name ?? 'Guest') : (booking.host_name ?? 'Host')
                            return (
                              <div
                                key={booking.id}
                                onClick={() => onNavigate('bookings')}
                                className={`rounded-xl p-2 cursor-pointer hover:opacity-90 transition-opacity ${
                                  isHost ? 'bg-[#6366F1] text-white' : 'bg-[#E0E7FF] text-[#6366F1]'
                                }`}
                              >
                                <p className="text-[11px] font-bold truncate">{otherName.split(' ')[0]}</p>
                                <p className={`text-[11px] ${isHost ? 'text-[#E0E7FF]' : 'text-[#6366F1]'}`}>{formatClock(bookingStart(booking))}</p>
                                <p className={`text-[11px] ${isHost ? 'text-[#E0E7FF]' : 'text-[#6366F1]'}`}>{booking.duration}m</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-[#64748B] text-center py-3 border-t border-gray-100">
                  {weekBookings.length === 0 ? 'No bookings this week' : 'Click a booking to view details'}
                </p>
              </div>

              {/* Upcoming list */}
              <div>
                <h2 className="text-base font-bold text-[#0F172A] mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Upcoming bookings
                </h2>
                <div className="space-y-3">
                  {upcomingList.length === 0 ? (
                    <p className="text-sm text-[#64748B] text-center py-4">No upcoming bookings</p>
                  ) : upcomingList.map((booking) => {
                    const isHost = booking.role === 'host'
                    const otherName = isHost ? (booking.guest_name ?? 'Guest') : (booking.host_name ?? 'Host')
                    const nameInitials = otherName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
                    const start = bookingStart(booking)
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
                          <p className="text-xs text-[#64748B]">
                            {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {formatClock(start)} · {booking.duration} min
                          </p>
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
          )
        })()}

        {/* Month view */}
        {view === 'month' && (() => {
          const year = monthStart.getFullYear()
          const month = monthStart.getMonth()
          const lead = (new Date(year, month, 1).getDay() + 6) % 7 // Monday first
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const cells: (Date | null)[] = [
            ...Array.from({ length: lead }, () => null),
            ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
          ]
          return (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setMonthStart(new Date(year, month - 1, 1))}
                  aria-label="Previous month"
                  className="p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors"
                >
                  <ChevronLeft size={18} className="text-[#64748B]" />
                </button>
                <p className="text-sm font-semibold text-[#0F172A]">{monthLabel(monthStart)}</p>
                <button
                  onClick={() => setMonthStart(new Date(year, month + 1, 1))}
                  aria-label="Next month"
                  className="p-2 rounded-xl hover:bg-[#F8FAFC] transition-colors"
                >
                  <ChevronRight size={18} className="text-[#64748B]" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="text-center text-xs font-semibold text-[#64748B] py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  const isToday = day ? sameDay(day, NOW_AT_LOAD) : false
                  const count = day ? upcomingBookings.filter((bk) => sameDay(bookingStart(bk), day)).length : 0
                  return (
                    <div
                      key={i}
                      className={`aspect-square flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                        isToday
                          ? 'bg-[#6366F1] text-white'
                          : count > 0
                          ? 'bg-[#E0E7FF] text-[#6366F1]'
                          : day
                          ? 'text-[#0F172A]'
                          : ''
                      }`}
                    >
                      {day?.getDate()}
                      {count > 0 && !isToday && <span className="w-1 h-1 rounded-full bg-[#6366F1] mt-0.5" />}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

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
                        <select
                          aria-label={`${slot.day} start time`}
                          value={slot.start}
                          onChange={(e) => setSlotTime(slot.day, 'start', e.target.value)}
                          className="bg-[#F8FAFC] border border-gray-100 text-[#0F172A] px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {(START_CHOICES.includes(slot.start) ? START_CHOICES : [...START_CHOICES, slot.start]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <span>–</span>
                        <select
                          aria-label={`${slot.day} end time`}
                          value={slot.end}
                          onChange={(e) => setSlotTime(slot.day, 'end', e.target.value)}
                          className="bg-[#F8FAFC] border border-gray-100 text-[#0F172A] px-3 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                        >
                          {(END_CHOICES.includes(slot.end) ? END_CHOICES : [...END_CHOICES, slot.end]).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
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
                    onClick={() => setBufferMinutes(m)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      m === bufferMinutes ? 'bg-[#6366F1] text-white' : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                    }`}
                  >
                    {m === 0 ? 'None' : `${m} min`}
                  </button>
                ))}
              </div>
            </div>

            {saveSuccess && (
              <div className="mb-3 text-center text-sm font-medium text-emerald-600 bg-emerald-50 rounded-xl py-2.5">
                Availability saved successfully
              </div>
            )}
            {saveError && (
              <div className="mb-3 text-center text-sm font-medium text-red-600 bg-red-50 rounded-xl py-2.5 px-3">
                {saveError}
              </div>
            )}
            <button
              onClick={() => { void handleSaveAvailability() }}
              disabled={savingAvailability}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-60 text-white font-semibold py-3.5 rounded-2xl transition-all"
            >
              {savingAvailability ? 'Saving...' : 'Save availability'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
