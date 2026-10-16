import { useState, useEffect } from 'react'
import { Video, Mic, MicOff, VideoOff, Phone, CheckCircle2 } from 'lucide-react'
import { Logo } from '../components/Logo'

import type { Page } from '../App'

interface CallScreenProps {
  bookingId?: string
  onNavigate: (page: Page, username?: string) => void
}

function useTimer(running: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export function CallScreen({ onNavigate }: CallScreenProps) {
  const [micOn, setMicOn] = useState(true)
  const [videoOn, setVideoOn] = useState(true)
  const [callState, setCallState] = useState<'connecting' | 'active' | 'ended'>('connecting')
  const [showEndModal, setShowEndModal] = useState(false)
  const elapsed = useTimer(callState === 'active')

  useEffect(() => {
    const t = setTimeout(() => setCallState('active'), 2000)
    return () => clearTimeout(t)
  }, [])

  function handleEnd() {
    setShowEndModal(true)
  }

  function confirmEnd() {
    setCallState('ended')
    setShowEndModal(false)
  }

  if (callState === 'ended') {
    return (
      <div className="min-h-dvh bg-[#0F172A] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Call complete
          </h2>
          <p className="text-[#64748B] mb-6">Duration: {elapsed}</p>
          <p className="text-sm text-[#64748B] mb-8">
            Payment has been released from escrow.
            Your earnings will be available shortly.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => onNavigate('earnings')}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-4 rounded-2xl transition-all"
            >
              View earnings
            </button>
            <button
              onClick={() => onNavigate('bookings')}
              className="w-full border border-white/20 text-white font-medium py-4 rounded-2xl hover:bg-white/10 transition-colors"
            >
              Back to bookings
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#0F172A] flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4">
        <Logo size="sm" dark />
        <div className="flex items-center gap-3">
          {callState === 'active' && (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-mono text-white tabular-nums">{elapsed}</span>
            </div>
          )}
          {callState === 'connecting' && (
            <span className="text-sm text-[#64748B]">Connecting...</span>
          )}
        </div>
        <div className="w-8" />
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center px-4 pb-4 relative">
        {/* Remote video (main) */}
        <div className="w-full max-w-2xl aspect-video bg-[#1E293B] rounded-2xl flex items-center justify-center relative overflow-hidden">
          {callState === 'connecting' ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#6366F1] flex items-center justify-center mx-auto mb-3 animate-pulse">
                <span className="text-white font-bold">MC</span>
              </div>
              <p className="text-white font-semibold">Marcus Chen</p>
              <p className="text-[#64748B] text-sm mt-1">Connecting...</p>
            </div>
          ) : videoOn ? (
            <div className="w-full h-full bg-gradient-to-br from-[#1E293B] to-[#334155] flex items-center justify-center">
              <div className="text-center opacity-50">
                <Video size={48} className="text-[#64748B] mx-auto mb-2" />
                <p className="text-xs text-[#64748B]">Camera preview</p>
              </div>
            </div>
          ) : (
            <div className="w-full h-full bg-[#1E293B] flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[#6366F1] flex items-center justify-center">
                <span className="text-white font-bold text-xl">MC</span>
              </div>
            </div>
          )}

          {/* Remote name label */}
          {callState === 'active' && (
            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-xl">
              <p className="text-white text-xs font-semibold">Marcus Chen</p>
            </div>
          )}
        </div>

        {/* Self preview (PiP) */}
        {callState === 'active' && (
          <div className="absolute bottom-8 right-8 w-28 h-20 bg-[#334155] rounded-xl overflow-hidden border-2 border-[#6366F1]/50 flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-[#6366F1] flex items-center justify-center">
              <span className="text-white text-xs font-bold">YO</span>
            </div>
            {!videoOn && (
              <div className="absolute inset-0 bg-[#1E293B] flex items-center justify-center">
                <VideoOff size={16} className="text-[#64748B]" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-4 pb-8">
        <div className="flex items-center justify-center gap-4">
          {/* Mic */}
          <button
            onClick={() => setMicOn(!micOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              micOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>

          {/* End call */}
          <button
            onClick={handleEnd}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          >
            <Phone size={24} className="text-white rotate-[135deg]" />
          </button>

          {/* Camera */}
          <button
            onClick={() => setVideoOn(!videoOn)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              videoOn ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
            }`}
          >
            {videoOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
        </div>
      </div>

      {/* End call confirmation modal */}
      {showEndModal && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-[#1E293B] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              End this call?
            </h3>
            <p className="text-sm text-[#64748B] mb-6">
              The call will end and payment will be released from escrow.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowEndModal(false)}
                className="flex-1 border border-white/20 text-white font-medium py-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                Keep talking
              </button>
              <button
                onClick={confirmEnd}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                End call
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
