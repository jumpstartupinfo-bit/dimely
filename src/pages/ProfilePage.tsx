import type { Page } from '../App'
import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle2,
  MapPin,
  Globe,
  Video,
  Mic,
  Instagram,
  Twitter,
  Linkedin,
  Share2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Zap,
  Link,
  AlertCircle,
} from 'lucide-react'
import { profiles as profilesApi, type Profile } from '../lib/api'
import { Logo } from '../components/Logo'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CalendarDay {
  date: number
  isoDate: string
  label: string          // "Thu", "Fri", …
  dayLabel: string       // "Today", "Oct 9", …
  isToday: boolean
  slots: string[]        // loaded lazily
  slotsLoaded: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DURATIONS = [15, 30, 45, 60]

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/** Format a 24-h "HH:MM" slot as "H:MM AM/PM" for display. */
function formatSlot(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Build a CalendarDay object for UTC date offset `offset` from today. */
function buildDay(offset: number): CalendarDay {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
  const isoDate = d.toISOString().slice(0, 10)
  const isToday = offset === 0
  const dayLabel = isToday
    ? 'Today'
    : `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
  return {
    date: d.getUTCDate(),
    isoDate,
    label: DAY_NAMES[d.getUTCDay()],
    dayLabel,
    isToday,
    slots: [],
    slotsLoaded: false,
  }
}

// Build 7-day window once at module level — safe as a stable constant
const SEVEN_DAYS: CalendarDay[] = Array.from({ length: 7 }, (_, i) => buildDay(i))
// Stable calendar header values computed once at module load
const NOW_UTC = new Date()
const CALENDAR_MONTH_LABEL = `${MONTH_NAMES[NOW_UTC.getUTCMonth()]} ${NOW_UTC.getUTCFullYear()}`

// ─── Page skeleton ────────────────────────────────────────────────────────────

function ProfileSkeleton() {
  return (
    <div className="min-h-dvh bg-[#F8FAFC]">
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4">
        <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
        <Logo size="xs" />
        <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
      </div>
      <div className="max-w-5xl mx-auto px-4 pt-20 pb-8">
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div className="h-20 bg-gray-200" />
              <div className="px-5 pb-5 pt-2 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 -mt-8" />
                <div className="h-5 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-5/6" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="grid grid-cols-4 gap-2">
                {[0,1,2,3].map((i) => <div key={i} className="h-11 bg-gray-100 rounded-xl" />)}
              </div>
              <div className="h-20 bg-gray-100 rounded-2xl" />
              <div className="grid grid-cols-7 gap-2">
                {[0,1,2,3,4,5,6].map((i) => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfilePageProps {
  username: string
  onNavigate: (page: Page, username?: string) => void
}

export function ProfilePage({ username, onNavigate }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Calendar state — built once from SEVEN_DAYS constant
  const [days, setDays] = useState<CalendarDay[]>(SEVEN_DAYS)
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState(30)
  const [copied, setCopied] = useState(false)

  // Fetch profile
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setNotFound(false)
      try {
        const p = await profilesApi.get(username)
        if (!cancelled) setProfile(p)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [username])

  // Fetch slots for selected day
  const loadSlots = useCallback(async (dayIdx: number) => {
    const day = SEVEN_DAYS[dayIdx]
    if (!day) return
    setSlotsLoading(true)
    setSelectedSlot(null)
    try {
      const res = await profilesApi.availability(username, day.isoDate)
      setDays((prev) => prev.map((d, i) =>
        i === dayIdx ? { ...d, slots: res.slots.map(formatSlot), slotsLoaded: true } : d
      ))
    } catch {
      setDays((prev) => prev.map((d, i) =>
        i === dayIdx ? { ...d, slots: [], slotsLoaded: true } : d
      ))
    } finally {
      setSlotsLoading(false)
    }
  }, [username])

  // Load today's slots once profile is loaded
  useEffect(() => {
    if (!profile) return
    async function init() { await loadSlots(0) }
    void init()
  }, [profile, loadSlots])

  function handleSelectDay(idx: number) {
    setSelectedDayIdx(idx)
    if (!days[idx].slotsLoaded) {
      void loadSlots(idx)
    } else {
      setSelectedSlot(null)
    }
  }

  function handleCopyLink() {
    void navigator.clipboard.writeText(`dimely.com/${username}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleBooking() {
    if (selectedSlot) {
      onNavigate('booking', username)
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return <ProfileSkeleton />

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-red-400" />
          </div>
          <p className="font-bold text-[#0F172A] mb-2 text-lg" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Profile not found
          </p>
          <p className="text-sm text-[#64748B] mb-5">
            This profile doesn't exist, has been removed, or is not yet published.
          </p>
          <button
            onClick={() => onNavigate('discover')}
            className="text-sm bg-[#6366F1] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#4F46E5] transition-colors"
          >
            Back to Discover
          </button>
        </div>
      </div>
    )
  }

  // ── Computed values ────────────────────────────────────────────────────────
  const priceForDuration = profile.price_per_min * selectedDuration
  const platformFee = Math.round(priceForDuration * 0.2 * 100) / 100

  const selectedDay = days[selectedDayIdx]
  const socialLinks = profile.socialLinks ?? {}

  const languages: string[] = [] // not in DB yet — omit if empty

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4">
        <button
          onClick={() => onNavigate('discover')}
          className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <Logo size="xs" />
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-sm font-medium text-[#6366F1] hover:text-[#4F46E5]"
        >
          {copied ? <CheckCircle2 size={14} /> : <Share2 size={14} />}
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-20 pb-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left column — profile info ──────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Profile card */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="h-20 bg-gradient-to-r from-[#6366F1] to-[#818CF8]" />
              <div className="px-5 pb-5">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-lg -mt-8 mb-3 border-4 border-white shadow-md overflow-hidden"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.photo_url
                    ? <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
                    : profile.avatar_initials}
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h1
                        className="text-lg font-bold text-[#0F172A]"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {profile.name}
                      </h1>
                      {!!profile.verified && (
                        <CheckCircle2 size={16} className="text-[#6366F1]" fill="#6366F1" color="white" />
                      )}
                    </div>
                    <p className="text-sm text-[#64748B]">{profile.headline}</p>
                  </div>
                </div>
                {profile.location && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-[#64748B]">
                    <MapPin size={12} />
                    {profile.location}
                  </div>
                )}
                {profile.bio && (
                  <p className="text-sm text-[#64748B] mt-3 leading-relaxed" style={{ textWrap: 'pretty' }}>
                    {profile.bio}
                  </p>
                )}
                {(profile.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(profile.tags ?? []).map((tag) => (
                      <span key={tag} className="text-xs bg-[#F8FAFC] text-[#64748B] px-2.5 py-1 rounded-lg border border-gray-100">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Stats card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-2xl font-bold text-[#0F172A] tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    {profile.booking_count}
                  </p>
                  <p className="text-xs text-[#64748B]">Calls completed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0F172A] tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    ${profile.price_per_min}
                  </p>
                  <p className="text-xs text-[#64748B]">Per minute</p>
                </div>
              </div>
              <div className="border-t border-gray-100 mt-4 pt-4 flex flex-wrap gap-3">
                {!!profile.video_available && (
                  <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                    <Video size={13} className="text-[#6366F1]" />
                    Video calls
                  </div>
                )}
                {!!profile.voice_available && (
                  <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                    <Mic size={13} className="text-[#6366F1]" />
                    Voice calls
                  </div>
                )}
                {languages.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
                    <Globe size={13} className="text-[#6366F1]" />
                    {languages.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Availability indicator */}
            <div className={`rounded-2xl p-4 flex items-center gap-3 ${profile.available_today ? 'bg-emerald-50 border border-emerald-100' : 'bg-[#F8FAFC] border border-gray-100'}`}>
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${profile.available_today ? 'bg-emerald-500' : 'bg-gray-300'}`} />
              <div>
                <p className={`text-sm font-semibold ${profile.available_today ? 'text-emerald-700' : 'text-[#64748B]'}`}>
                  {profile.available_today ? 'Available today' : 'Next available'}
                </p>
                <p className="text-xs text-[#64748B]">{profile.next_available ?? 'No availability'}</p>
              </div>
            </div>

            {/* Social links */}
            {Object.values(socialLinks).some(Boolean) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Socials</p>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.instagram && (
                    <a href="#" className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-xl hover:bg-[#E0E7FF] hover:text-[#6366F1] transition-colors">
                      <Instagram size={13} /> @{socialLinks.instagram}
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href="#" className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-xl hover:bg-[#E0E7FF] hover:text-[#6366F1] transition-colors">
                      <Twitter size={13} /> @{socialLinks.twitter}
                    </a>
                  )}
                  {socialLinks.linkedin && (
                    <a href="#" className="flex items-center gap-1.5 text-xs text-[#64748B] bg-[#F8FAFC] px-3 py-2 rounded-xl hover:bg-[#E0E7FF] hover:text-[#6366F1] transition-colors">
                      <Linkedin size={13} /> {socialLinks.linkedin}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Share link */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#64748B] mb-0.5">Profile link</p>
                <p className="text-sm font-medium text-[#0F172A] truncate">dimely.com/{profile.username}</p>
              </div>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#6366F1] bg-[#E0E7FF] hover:bg-[#C7D2FE] px-3 py-2 rounded-xl transition-colors flex-shrink-0"
              >
                {copied ? <CheckCircle2 size={13} /> : <Link size={13} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* ── Right column — booking widget ───────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2
                className="text-lg font-bold text-[#0F172A] mb-5"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Book a call
              </h2>

              {/* Duration picker */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Duration</p>
                <div className="grid grid-cols-4 gap-2">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setSelectedDuration(d)}
                      className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                        selectedDuration === d
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                      }`}
                    >
                      {d} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Price preview */}
              <div className="bg-[#F8FAFC] rounded-2xl p-4 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#64748B]">{selectedDuration} min × ${profile.price_per_min}/min</span>
                  <span className="text-sm font-bold text-[#0F172A] tabular-nums">${priceForDuration}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[#64748B]">Platform fee (20%)</span>
                  <span className="text-sm text-[#64748B] tabular-nums">${platformFee}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#0F172A]">Total</span>
                  <span className="text-base font-bold text-[#0F172A] tabular-nums">${priceForDuration}</span>
                </div>
              </div>

              {/* Date picker */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Choose a date</p>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-[#64748B]"><ChevronLeft size={14} /></button>
                    <span className="text-xs font-medium text-[#0F172A] px-1">
                      {CALENDAR_MONTH_LABEL}
                    </span>
                    <button className="p-1.5 rounded-lg hover:bg-gray-100 text-[#64748B]"><ChevronRight size={14} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {days.map((day, i) => {
                    const isSelected = selectedDayIdx === i
                    const hasSlots = day.slotsLoaded ? day.slots.length > 0 : true // assume possible until loaded
                    return (
                      <button
                        key={day.isoDate}
                        onClick={() => handleSelectDay(i)}
                        disabled={day.slotsLoaded && day.slots.length === 0}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors ${
                          isSelected
                            ? 'bg-[#6366F1] text-white'
                            : !hasSlots
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                        }`}
                      >
                        <span className="text-xs font-medium">{day.label}</span>
                        <span className="text-sm font-bold">{day.date}</span>
                        {day.isToday && (
                          <span className={`text-xs font-medium ${isSelected ? 'text-[#A5B4FC]' : 'text-[#6366F1]'}`}>
                            Today
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time slots */}
              {slotsLoading ? (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Loading times...</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[0,1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}
                  </div>
                </div>
              ) : selectedDay.slotsLoaded && selectedDay.slots.length > 0 ? (
                <div className="mb-6">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">
                    Available times — {selectedDay.dayLabel}
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {selectedDay.slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-3 rounded-xl text-sm font-semibold transition-colors ${
                          selectedSlot === slot
                            ? 'bg-[#6366F1] text-white'
                            : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              ) : selectedDay.slotsLoaded && selectedDay.slots.length === 0 ? (
                <div className="text-center py-6 mb-4">
                  <Clock size={24} className="text-[#64748B] mx-auto mb-2" />
                  <p className="text-sm text-[#64748B]">No availability on this date</p>
                </div>
              ) : null}

              {/* CTA */}
              <button
                onClick={handleBooking}
                disabled={!selectedSlot}
                className={`w-full py-4 rounded-2xl text-base font-semibold transition-all ${
                  selectedSlot
                    ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]'
                    : 'bg-gray-100 text-[#64748B] cursor-not-allowed'
                }`}
              >
                {selectedSlot
                  ? `Book ${selectedDuration} min · $${priceForDuration}`
                  : 'Select a time to continue'}
              </button>

              {selectedSlot && (
                <p className="text-center text-xs text-[#64748B] mt-3">
                  Your payment is held securely until the call is complete.
                </p>
              )}
            </div>

            {/* Call type info */}
            {(!!profile.video_available || !!profile.voice_available) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Call options</p>
                <div className="grid grid-cols-2 gap-3">
                  {!!profile.video_available && (
                    <div className="bg-[#F8FAFC] rounded-xl p-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                        <Video size={15} className="text-[#6366F1]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#0F172A]">Video call</p>
                        <p className="text-xs text-[#64748B]">Face-to-face</p>
                      </div>
                    </div>
                  )}
                  {!!profile.voice_available && (
                    <div className="bg-[#F8FAFC] rounded-xl p-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] flex items-center justify-center">
                        <Mic size={15} className="text-[#6366F1]" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#0F172A]">Voice call</p>
                        <p className="text-xs text-[#64748B]">Audio only</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Trust / cancellation */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">Good to know</p>
              <div className="space-y-2.5">
                {[
                  { icon: CheckCircle2, text: 'Payment is held securely until your call completes' },
                  { icon: CheckCircle2, text: 'Cancel up to 24 hours before for a full refund' },
                  { icon: Zap, text: "You'll receive a join link by email before your call" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <Icon size={14} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-[#64748B]">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
