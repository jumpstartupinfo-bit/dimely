import type { Page } from '../App'
import { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Video,
  Mic,
  Clock,
  Shield,
  Calendar,
  User,
  Mail,
  MessageSquare,
  Loader2,
  X,
} from 'lucide-react'
import { profiles as profilesApi, bookings as bookingsApi } from '../lib/api'
import type { Profile } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { v4 as uuidv4 } from 'uuid'
import { UsdcPaymentButton } from '../components/UsdcPaymentButton'

interface BookingFlowProps {
  username: string
  onNavigate: (page: Page, username?: string) => void
}

type Step = 'date' | 'time' | 'duration' | 'type' | 'details' | 'payment' | 'confirm'

const DURATIONS = [15, 30, 45, 60]
const STEPS: Step[] = ['date', 'time', 'duration', 'type', 'details', 'payment', 'confirm']

// Build a 7-day window starting from today
function buildWeekDays() {
  const days = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    days.push({
      date: d.getDate(),
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
      isoDate: d.toISOString().slice(0, 10),
      today: i === 0,
    })
  }
  return days
}

const WEEK_DAYS = buildWeekDays()

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current)
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.slice(0, -1).map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < idx
                ? 'bg-[#6366F1] text-white'
                : i === idx
                ? 'bg-[#E0E7FF] text-[#6366F1] ring-2 ring-[#6366F1]'
                : 'bg-gray-100 text-[#64748B]'
            }`}
          >
            {i < idx ? <CheckCircle2 size={12} /> : i + 1}
          </div>
          {i < steps.length - 2 && (
            <div className={`w-4 h-0.5 rounded ${i < idx ? 'bg-[#6366F1]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

export function BookingFlow({ username, onNavigate }: BookingFlowProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [step, setStep] = useState<Step>('date')
  const [selectedDay, setSelectedDay] = useState<(typeof WEEK_DAYS)[0] | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null)
  const [callType, setCallType] = useState<'video' | 'voice' | null>(null)
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [topic, setTopic] = useState('')
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingCreated, setBookingCreated] = useState(false)
  const [idempotencyKey] = useState(() => uuidv4())

  // Load real profile from API
  useEffect(() => {
    setProfileLoading(true)
    profilesApi.get(username)
      .then(res => setProfile('profile' in res ? (res as { profile: Profile }).profile : res))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false))
  }, [username])

  // Auto-create booking record when user reaches payment step (they're authenticated)
  useEffect(() => {
    if (step !== 'payment' || !user || bookingCreated) return
    async function autoCreate() {
      await ensureBookingCreated()
    }
    void autoCreate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, user])

  // Load available slots when a day is selected
  useEffect(() => {
    if (!selectedDay) return
    let cancelled = false
    async function loadSlots() {
      setSlotsLoading(true)
      setSlots([])
      setSelectedSlot(null)
      try {
        const res = await profilesApi.availability(username, selectedDay!.isoDate)
        if (!cancelled) setSlots(res.slots)
      } catch {
        if (!cancelled) setSlots(['9:00 AM', '10:00 AM', '1:00 PM', '3:00 PM', '5:00 PM'])
      } finally {
        if (!cancelled) setSlotsLoading(false)
      }
    }
    void loadSlots()
    return () => { cancelled = true }
  }, [selectedDay, username])

  if (profileLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#6366F1]" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <p className="text-[#64748B]">Profile not found</p>
      </div>
    )
  }

  const price = selectedDuration ? parseFloat(String(profile.price_per_min)) * selectedDuration : 0
  const platformFee = selectedDuration ? Math.round(price * 0.2 * 100) / 100 : 0

  function next() {
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  function back() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
    else onNavigate('profile', username)
  }

  // Step 1: Create the booking record (payment_pending state)
  async function ensureBookingCreated(): Promise<string | null> {
    if (bookingId) return bookingId
    if (!selectedDay || !selectedSlot || !selectedDuration || !callType) return null
    setBookingError(null)
    try {
      // Convert slot time to HH:MM — slots from real API are already "09:00" format
      // but fallback slots may be "9:00 AM" format
      let startTime = selectedSlot
      if (selectedSlot.includes('AM') || selectedSlot.includes('PM')) {
        const [time, period] = selectedSlot.split(' ')
        const [hourStr, minStr] = time.split(':')
        let h = parseInt(hourStr)
        if (period === 'PM' && h !== 12) h += 12
        if (period === 'AM' && h === 12) h = 0
        startTime = `${String(h).padStart(2, '0')}:${minStr}`
      }
      const res = await bookingsApi.create({
        profileUsername: username,
        date: selectedDay.isoDate,
        startTime,
        duration: selectedDuration,
        callType,
        topic,
        guestName: name,
        guestEmail: email,
        idempotencyKey,
      })
      setBookingId(res.bookingId)
      setBookingCreated(true)
      return res.bookingId
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed. Please try again.'
      setBookingError(msg)
      return null
    }
  }

  // Called when UsdcPaymentButton reports server-verified success
  function handlePaymentSuccess(_txHash: string) {
    setStep('confirm')
  }

  const canProceed = () => {
    if (step === 'date') return selectedDay !== null
    if (step === 'time') return selectedSlot !== null
    if (step === 'duration') return selectedDuration !== null
    if (step === 'type') return callType !== null
    if (step === 'details') return name.trim() !== '' && email.trim() !== '' && topic.trim() !== ''
    return true
  }

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-4">
        <button onClick={back} className="flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A]">
          <ChevronLeft size={16} />
          {step === 'date' ? 'Back' : 'Previous'}
        </button>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ backgroundColor: profile.avatar_color ?? "#6366F1" }}
          >
            {profile.avatar_initials ?? profile.name.slice(0,2).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-[#0F172A]">{profile.name}</span>
        </div>
        <button onClick={() => onNavigate('discover')} className="p-2 text-[#64748B] hover:text-[#0F172A]">
          <X size={18} />
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-20 pb-8">
        {step !== 'confirm' && <StepIndicator current={step} steps={STEPS} />}

        {/* Step: Date */}
        {step === 'date' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Choose a date
            </h2>
            <p className="text-sm text-[#64748B] mb-6">Next 7 days · Times in your local timezone</p>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="grid grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day.isoDate}
                    onClick={() => setSelectedDay(day)}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl transition-colors ${
                      selectedDay?.isoDate === day.isoDate
                        ? 'bg-[#6366F1] text-white'
                        : 'hover:bg-[#E0E7FF] hover:text-[#6366F1] text-[#0F172A]'
                    }`}
                  >
                    <span className="text-xs font-medium">{day.dow}</span>
                    <span className="text-sm font-bold">{day.date}</span>
                    {day.today && (
                      <span className={`text-xs ${selectedDay?.isoDate === day.isoDate ? 'text-[#A5B4FC]' : 'text-[#6366F1]'}`}>
                        Today
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Time */}
        {step === 'time' && selectedDay && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Choose a time
            </h2>
            <p className="text-sm text-[#64748B] mb-6">
              {selectedDay.today ? 'Today' : `${selectedDay.dow}, ${selectedDay.date}`} · All times in your local timezone
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-[#6366F1]" />
                </div>
              ) : slots.length === 0 ? (
                <div className="text-center py-8 text-sm text-[#64748B]">
                  No slots available on this day. Please pick another date.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {slots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-4 rounded-xl text-sm font-semibold transition-colors ${
                        selectedSlot === slot
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Duration */}
        {step === 'duration' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              How long?
            </h2>
            <p className="text-sm text-[#64748B] mb-6">${parseFloat(String(profile.price_per_min))}/min · Choose your session length</p>
            <div className="space-y-3">
              {DURATIONS.map((d) => {
                const p = parseFloat(String(profile.price_per_min)) * d
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedDuration(d)}
                    className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                      selectedDuration === d
                        ? 'border-[#6366F1] bg-[#E0E7FF]'
                        : 'border-gray-100 bg-white hover:border-[#A5B4FC]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedDuration === d ? 'bg-[#6366F1]' : 'bg-[#F8FAFC]'}`}>
                        <Clock size={16} className={selectedDuration === d ? 'text-white' : 'text-[#64748B]'} />
                      </div>
                      <div className="text-left">
                        <p className={`font-semibold ${selectedDuration === d ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>
                          {d} minutes
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {d === 15 ? 'Quick check-in' : d === 30 ? 'Standard session' : d === 45 ? 'Deep dive' : 'Full hour'}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold tabular-nums ${selectedDuration === d ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>
                      ${p}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step: Call type */}
        {step === 'type' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Voice or video?
            </h2>
            <p className="text-sm text-[#64748B] mb-6">Choose how you want to connect</p>
            <div className="space-y-3">
              {profile.video_available && (
                <button
                  onClick={() => setCallType('video')}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${
                    callType === 'video' ? 'border-[#6366F1] bg-[#E0E7FF]' : 'border-gray-100 bg-white hover:border-[#A5B4FC]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${callType === 'video' ? 'bg-[#6366F1]' : 'bg-[#F8FAFC]'}`}>
                    <Video size={22} className={callType === 'video' ? 'text-white' : 'text-[#6366F1]'} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${callType === 'video' ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>Video call</p>
                    <p className="text-sm text-[#64748B]">Face-to-face. See and be seen.</p>
                  </div>
                  {callType === 'video' && <CheckCircle2 size={20} className="text-[#6366F1] ml-auto" />}
                </button>
              )}
              {profile.voice_available && (
                <button
                  onClick={() => setCallType('voice')}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${
                    callType === 'voice' ? 'border-[#6366F1] bg-[#E0E7FF]' : 'border-gray-100 bg-white hover:border-[#A5B4FC]'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${callType === 'voice' ? 'bg-[#6366F1]' : 'bg-[#F8FAFC]'}`}>
                    <Mic size={22} className={callType === 'voice' ? 'text-white' : 'text-[#6366F1]'} />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${callType === 'voice' ? 'text-[#6366F1]' : 'text-[#0F172A]'}`}>Voice call</p>
                    <p className="text-sm text-[#64748B]">Audio only. No camera needed.</p>
                  </div>
                  {callType === 'voice' && <CheckCircle2 size={20} className="text-[#6366F1] ml-auto" />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step: Details */}
        {step === 'details' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Your details
            </h2>
            <p className="text-sm text-[#64748B] mb-6">Help {profile.name.split(' ')[0]} prepare for your call</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Your name</label>
                <div className="relative">
                  <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full bg-white border border-gray-200 text-[#0F172A] placeholder-[#64748B] pl-10 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Email address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-white border border-gray-200 text-[#0F172A] placeholder-[#64748B] pl-10 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">What do you want to talk about?</label>
                <div className="relative">
                  <MessageSquare size={15} className="absolute left-4 top-4 text-[#64748B]" />
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder={`What would you like to discuss with ${profile.name.split(' ')[0]}?`}
                    rows={4}
                    className="w-full bg-white border border-gray-200 text-[#0F172A] placeholder-[#64748B] pl-10 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent resize-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step: Payment */}
        {step === 'payment' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Review & pay
            </h2>
            <p className="text-sm text-[#64748B] mb-6">Your payment is held securely until the call completes</p>

            {bookingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-4">
                {bookingError}
              </div>
            )}

            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: profile.avatar_color ?? "#6366F1" }}
                >
                  {profile.avatar_initials ?? profile.name.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A]">{profile.name}</p>
                  <p className="text-xs text-[#64748B]">{profile.headline}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Date', value: selectedDay?.today ? `Today, ${selectedDay.dow} ${selectedDay.date}` : `${selectedDay?.dow} ${selectedDay?.date}` },
                  { label: 'Time', value: selectedSlot ?? '' },
                  { label: 'Duration', value: `${selectedDuration} minutes` },
                  { label: 'Call type', value: callType === 'video' ? 'Video call' : 'Voice call' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">{label}</span>
                    <span className="text-sm font-medium text-[#0F172A]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price breakdown */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">{selectedDuration} min × ${parseFloat(String(profile.price_per_min))}/min</span>
                <span className="text-sm font-medium text-[#0F172A] tabular-nums">${price}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#64748B]">Platform fee (20%)</span>
                <span className="text-sm text-[#64748B] tabular-nums">${platformFee.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex items-center justify-between">
                <span className="font-semibold text-[#0F172A]">Total</span>
                <span className="text-xl font-bold text-[#0F172A] tabular-nums">${price}</span>
              </div>
            </div>

            {/* Cancellation policy */}
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
              <p className="text-xs font-semibold text-amber-700 mb-1">Cancellation policy</p>
              <p className="text-xs text-amber-600">
                Free cancellation up to 24 hours before. Cancellations within 24 hours receive a 50% refund. No refund for no-shows.
              </p>
            </div>

            {/* Auth gate — must be signed in to pay */}
            {!user ? (
              <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-5 text-center">
                <p className="font-semibold text-[#4338CA] mb-1">Sign in to complete your booking</p>
                <p className="text-sm text-[#6366F1] mb-4">Create a free account or sign in — it only takes a moment.</p>
                <button
                  onClick={() => onNavigate('onboarding')}
                  className="w-full py-3 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold text-sm transition-colors"
                >
                  Sign in or create account
                </button>
              </div>
            ) : !bookingId ? (
              /* Booking record is being created automatically — show spinner */
              <button disabled className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 bg-[#A5B4FC] text-white cursor-not-allowed">
                <Loader2 size={18} className="animate-spin" />Preparing payment...
              </button>
            ) : (
              <UsdcPaymentButton
                bookingId={bookingId}
                displayPrice={price}
                onSuccess={handlePaymentSuccess}
                onError={(msg) => setBookingError(msg)}
              />
            )}
            <p className="text-center text-xs text-[#64748B] mt-3">
              Powered by USDC · Secured by escrow
            </p>
          </div>
        )}

        {/* Step: Confirmed */}
        {step === 'confirm' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h2
              className="text-3xl font-bold text-[#0F172A] mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
            >
              Booking confirmed!
            </h2>
            <p className="text-[#64748B] mb-8">
              Your call with {profile.name} is scheduled.
              {bookingId && <span className="block text-xs text-[#94A3B8] mt-1">Booking #{bookingId.slice(0, 8)}</span>}
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6 text-left">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: profile.avatar_color ?? "#6366F1" }}
                >
                  {profile.avatar_initials ?? profile.name.slice(0,2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-[#0F172A]">{profile.name}</p>
                  <p className="text-xs text-[#64748B]">{profile.headline}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Calendar size={14} className="text-[#6366F1]" />
                  {selectedDay?.today ? `Today, ${selectedDay.dow} ${selectedDay.date}` : `${selectedDay?.dow} ${selectedDay?.date}`} · {selectedSlot}
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Clock size={14} className="text-[#6366F1]" />
                  {selectedDuration} minutes · {callType === 'video' ? 'Video call' : 'Voice call'}
                </div>
                <div className="flex items-center gap-2 text-[#64748B]">
                  <Shield size={14} className="text-[#6366F1]" />
                  ${price} paid securely · held in escrow
                </div>
              </div>
            </div>

            <div className="bg-[#E0E7FF] rounded-2xl p-4 mb-6 text-left">
              <p className="text-sm font-semibold text-[#6366F1] mb-1">A join link is on its way</p>
              <p className="text-xs text-[#64748B]">
                We've sent a confirmation and call link to {email}. You'll also get a reminder 15 minutes before.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => onNavigate('bookings')}
                className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-4 rounded-2xl transition-all"
              >
                View booking
              </button>
              <button
                onClick={() => onNavigate('discover')}
                className="w-full bg-white border border-gray-200 text-[#0F172A] font-medium py-4 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                Discover more people
              </button>
            </div>
          </div>
        )}

        {/* Continue button */}
        {step !== 'confirm' && step !== 'payment' && (
          <button
            onClick={next}
            disabled={!canProceed()}
            className={`w-full mt-8 py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
              canProceed()
                ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]'
                : 'bg-gray-100 text-[#64748B] cursor-not-allowed'
            }`}
          >
            Continue
            <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
