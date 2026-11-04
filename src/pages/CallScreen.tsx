import { useCallback, useEffect, useRef, useState } from 'react'
import DailyIframe, { type DailyCall } from '@daily-co/daily-js'
import { Video, Mic, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Logo } from '../components/Logo'
import { calls as callsApi, ApiError, type CallStatus } from '../lib/api'

import type { Page } from '../App'

interface CallScreenProps {
  bookingId?: string
  onNavigate: (page: Page, username?: string) => void
}

type Phase = 'loading' | 'error' | 'lobby' | 'joining' | 'in_call' | 'left'

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

function outcomeMessage(status: CallStatus): string {
  switch (status.outcome) {
    case 'completed':
      return 'Your call took place. Earnings are released to the host after a short review period.'
    case 'guest_no_show':
      return status.role === 'host'
        ? 'Your guest did not join. Your earnings are released after the review period.'
        : 'You did not join this call. Missed calls are not refunded.'
    case 'host_no_show':
    case 'both_no_show':
      return status.role === 'guest'
        ? 'The call did not take place. You will be refunded in full.'
        : 'The call did not take place and the guest is being refunded.'
    case 'needs_review':
      return 'We are reviewing how this call went. The payment stays safely held while we do.'
    default:
      return 'This call has ended. We confirm how it went shortly after it finishes.'
  }
}

export function CallScreen({ bookingId, onNavigate }: CallScreenProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [status, setStatus] = useState<CallStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(() => Date.now())
  const offsetRef = useRef(0)
  const frameRef = useRef<DailyCall | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const refresh = useCallback(async () => {
    if (!bookingId) return
    try {
      const s = await callsApi.status(bookingId)
      offsetRef.current = s.serverNow - Date.now()
      setStatus(s)
      setPhase((p) => (p === 'loading' || p === 'error' ? 'lobby' : p))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this call.')
      setPhase((p) => (p === 'loading' ? 'error' : p))
    }
  }, [bookingId])

  // Load the call, and keep it fresh until the person is in the call
  useEffect(() => {
    if (!bookingId) return
    async function load() { await refresh() }
    void load()
    const poll = setInterval(() => { if (!frameRef.current) void refresh() }, 20_000)
    return () => clearInterval(poll)
  }, [bookingId, refresh])

  // One-second clock for the countdown, corrected to the server's time
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offsetRef.current), 1000)
    return () => clearInterval(tick)
  }, [])

  // Remove the call window if the person navigates away
  useEffect(() => {
    return () => {
      frameRef.current?.destroy().catch(() => undefined)
      frameRef.current = null
    }
  }, [])

  const joinCall = useCallback(async () => {
    if (!bookingId) return
    setError(null)
    setPhase('joining')
    try {
      const join = await callsApi.join(bookingId)
      const container = containerRef.current
      if (!container) throw new Error('The call window is not ready. Please try again.')

      const frame = DailyIframe.createFrame(container, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '16px' },
      })
      frameRef.current = frame

      frame.on('left-meeting', () => {
        frame.destroy().catch(() => undefined)
        frameRef.current = null
        setPhase('left')
        void refresh()
      })

      await frame.join({ url: join.url, token: join.token })
      setPhase('in_call')
    } catch (err) {
      frameRef.current?.destroy().catch(() => undefined)
      frameRef.current = null
      setError(err instanceof Error ? err.message : 'Could not join the call. Please try again.')
      setPhase('lobby')
    }
  }, [bookingId, refresh])

  // ─── No call selected ──────────────────────────────────────────────────────
  if (!bookingId) {
    return (
      <Shell>
        <Card>
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No call selected</p>
          <p className="text-sm text-[#94A3B8] mb-5">Open your call from the link in your booking email or from Bookings.</p>
          <PrimaryButton onClick={() => onNavigate('bookings')}>Go to bookings</PrimaryButton>
        </Card>
      </Shell>
    )
  }

  const inCallView = phase === 'in_call' || phase === 'joining'
  const timeLeftToOpen = status ? status.opensAt - now : 0
  const timeLeftToStart = status ? status.startsAt - now : 0

  return (
    <div className="min-h-dvh bg-[#0F172A] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex items-center justify-between px-4 py-4">
        <Logo size="sm" dark />
        {status && inCallView && (
          <span className="text-xs text-[#94A3B8]">
            Booked until {new Date(status.endsAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <div className="w-8" />
      </div>

      {/* The live call mounts here and stays mounted while it is in progress */}
      <div className={inCallView ? 'flex-1 px-4 pb-6' : 'hidden'}>
        <div ref={containerRef} className="w-full h-full min-h-[60dvh] rounded-2xl overflow-hidden bg-[#1E293B]" />
      </div>

      {!inCallView && (
        <div className="flex-1 flex items-center justify-center px-4 pb-10">
          {phase === 'loading' && <Loader2 size={28} className="animate-spin text-[#6366F1]" />}

          {phase === 'error' && (
            <Card>
              <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-1">We could not open this call</p>
              <p className="text-sm text-[#94A3B8] mb-5">{error}</p>
              <PrimaryButton onClick={() => onNavigate('bookings')}>Go to bookings</PrimaryButton>
            </Card>
          )}

          {(phase === 'lobby' || phase === 'left') && status && (
            <Card>
              {phase === 'left' && (
                <p className="text-sm text-emerald-300 mb-4">You left the call.</p>
              )}
              <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Your call with {status.otherName}
              </h1>
              <p className="text-sm text-[#94A3B8] mb-1">
                {new Date(status.startsAt).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-xs text-[#64748B] mb-5">
                {status.duration} minutes. {status.callType === 'video' ? 'Video call' : 'Voice call'}. Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </p>

              {status.state === 'too_early' && (
                <>
                  <div className="flex items-center justify-center gap-2 bg-white/5 rounded-xl py-3 mb-4">
                    <Clock size={16} className="text-[#A5B4FC]" />
                    <span className="text-sm text-white">The call opens in <span className="font-mono tabular-nums">{formatCountdown(timeLeftToOpen)}</span></span>
                  </div>
                  <p className="text-xs text-[#64748B] mb-4">You can join 10 minutes before the call starts.</p>
                  <PrimaryButton disabled>Join call</PrimaryButton>
                </>
              )}

              {status.state === 'open' && (
                <>
                  <p className="text-xs text-[#94A3B8] mb-4 flex items-center justify-center gap-3">
                    <span className="inline-flex items-center gap-1"><Video size={13} />Camera</span>
                    <span className="inline-flex items-center gap-1"><Mic size={13} />Microphone</span>
                    <span>Allow access when your browser asks.</span>
                  </p>
                  {timeLeftToStart > 0 && (
                    <p className="text-xs text-[#64748B] mb-3">Starts in <span className="font-mono tabular-nums">{formatCountdown(timeLeftToStart)}</span></p>
                  )}
                  <PrimaryButton onClick={() => { void joinCall() }}>{phase === 'left' ? 'Rejoin call' : 'Join call'}</PrimaryButton>
                </>
              )}

              {status.state === 'ended' && (
                <>
                  <div className="flex items-start gap-2 bg-white/5 rounded-xl p-3 mb-4 text-left">
                    <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-[#CBD5E1]">{outcomeMessage(status)}</p>
                  </div>
                  <PrimaryButton onClick={() => onNavigate('bookings')}>Back to bookings</PrimaryButton>
                </>
              )}

              {status.state === 'unavailable' && (
                <>
                  <p className="text-sm text-[#CBD5E1] mb-4">{status.reason ?? 'This call is not available.'}</p>
                  <PrimaryButton onClick={() => onNavigate('bookings')}>Back to bookings</PrimaryButton>
                </>
              )}

              {error && <p className="text-sm text-red-300 mt-4">{error}</p>}
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#0F172A] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="px-4 py-4"><Logo size="sm" dark /></div>
      <div className="flex-1 flex items-center justify-center px-4 pb-10">{children}</div>
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-md bg-[#1E293B] border border-white/10 rounded-2xl p-6 text-center">
      {children}
    </div>
  )
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:bg-[#334155] disabled:text-[#64748B] disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
    >
      {children}
    </button>
  )
}
