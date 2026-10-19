import type { Page } from '../App'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { profilesApi } from '../lib/api'
import { User, Bell, Shield, DollarSign, ChevronRight, CheckCircle2, LogOut, Video, Mic } from 'lucide-react'

interface SettingsPageProps {
  onNavigate: (page: Page, username?: string) => void
  onLogout: () => void
}

const NOTIFICATION_SETTINGS = [
  { key: 'new_booking', label: 'New booking', description: 'When someone books a call with you' },
  { key: 'reminder', label: 'Call reminders', description: '15 minutes before your call starts' },
  { key: 'payment', label: 'Payment released', description: 'When earnings are released to your wallet' },
  { key: 'referral', label: 'Referral activity', description: 'Signups and earnings from your referrals' },
  { key: 'ai', label: 'AI agent activity', description: 'Actions taken by your AI agent' },
]

export function SettingsPage({ onNavigate: _onNavigate, onLogout }: SettingsPageProps) {
  const { user, profile } = useAuth()
  const [section, setSection] = useState<'main' | 'profile' | 'notifications' | 'billing' | 'security'>('main')
  const [notifs, setNotifs] = useState<Record<string, boolean>>({
    new_booking: true, reminder: true, payment: true, referral: true, ai: true,
  })
  const [pricePerMin, setPricePerMin] = useState(String(profile?.price_per_min ?? '6'))
  const [videoEnabled, setVideoEnabled] = useState(profile?.video_available ?? true)
  const [voiceEnabled, setVoiceEnabled] = useState(profile?.voice_available ?? true)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  async function saveProfile() {
    if (!user?.username) return
    setSaving(true)
    setSaveError('')
    try {
      await profilesApi.update(user.username, {
        price_per_min: parseFloat(pricePerMin),
        video_available: videoEnabled,
        voice_available: voiceEnabled,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const MENU_ITEMS = [
    { key: 'profile', label: 'My Dimely', description: 'Profile, pricing, call settings', icon: User, color: '#6366F1' },
    { key: 'notifications', label: 'Notifications', description: 'What to be notified about', icon: Bell, color: '#F59E0B' },
    { key: 'billing', label: 'Billing & Wallet', description: 'Payout settings and history', icon: DollarSign, color: '#059669' },
    { key: 'security', label: 'Privacy & Security', description: 'Account security and data', icon: Shield, color: '#8B5CF6' },
  ]

  if (section === 'main') {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-[#0F172A] mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Settings
          </h1>

          {/* Profile summary */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#6366F1] flex items-center justify-center text-white font-bold text-base flex-shrink-0">
              YO
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Your Name</p>
              <p className="text-sm text-[#64748B]">dimely.com/you</p>
            </div>
            <button
              onClick={() => setSection('profile')}
              className="text-xs font-semibold text-[#6366F1] bg-[#E0E7FF] px-3 py-2 rounded-xl hover:bg-[#C7D2FE] transition-colors"
            >
              Edit
            </button>
          </div>

          {/* Menu */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-5">
            {MENU_ITEMS.map(({ key, label, description, icon: Icon, color }, i) => (
              <button
                key={key}
                onClick={() => setSection(key as typeof section)}
                className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F8FAFC] transition-colors text-left ${i < MENU_ITEMS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '15' }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                  <p className="text-xs text-[#64748B]">{description}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>

          {/* Danger zone */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-red-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <LogOut size={18} className="text-red-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-500">Log out</p>
                <p className="text-xs text-[#64748B]">Sign out of your account</p>
              </div>
            </button>
          </div>

          <p className="text-center text-xs text-[#64748B] mt-6">Dimely · Version 1.0 · © 2026</p>
        </div>
      </div>
    )
  }

  if (section === 'profile') {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setSection('main')} className="text-sm text-[#6366F1] font-medium mb-6 hover:underline">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            My Dimely
          </h1>

          {/* Pricing */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Pricing
            </h2>
            <div className="mb-4">
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">
                Price per minute
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] font-semibold">$</span>
                <input
                  type="number"
                  value={pricePerMin}
                  onChange={(e) => setPricePerMin(e.target.value)}
                  min="1"
                  max="100"
                  className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] pl-8 pr-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>
            {pricePerMin && (
              <div className="bg-[#E0E7FF] rounded-xl p-3 text-xs text-[#6366F1]">
                At ${pricePerMin}/min: 15min = ${Number(pricePerMin) * 15} · 30min = ${Number(pricePerMin) * 30} · 60min = ${Number(pricePerMin) * 60}
              </div>
            )}
          </div>

          {/* Call types */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h2 className="text-sm font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Call types
            </h2>
            <div className="space-y-3">
              {[
                { key: 'video', label: 'Video calls', description: 'Allow people to book video calls', icon: Video, state: videoEnabled, toggle: setVideoEnabled },
                { key: 'voice', label: 'Voice calls', description: 'Allow people to book voice-only calls', icon: Mic, state: voiceEnabled, toggle: setVoiceEnabled },
              ].map(({ key, label, description, icon: Icon, state, toggle }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E0E7FF] flex items-center justify-center">
                      <Icon size={16} className="text-[#6366F1]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                      <p className="text-xs text-[#64748B]">{description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(!state)}
                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${state ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-1 transition-transform ${state ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {saveError && <p className="text-sm text-red-500 text-center mb-2">{saveError}</p>}
          <button
            onClick={() => { void saveProfile() }}
            disabled={saving}
            className="w-full bg-[#6366F1] hover:bg-[#4F46E5] disabled:opacity-60 text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {saved ? <><CheckCircle2 size={18} /> Saved!</> : saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    )
  }

  if (section === 'notifications') {
    return (
      <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setSection('main')} className="text-sm text-[#6366F1] font-medium mb-6 hover:underline">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-[#0F172A] mb-6" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Notifications
          </h1>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="space-y-5">
              {NOTIFICATION_SETTINGS.map(({ key, label, description }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{label}</p>
                    <p className="text-xs text-[#64748B]">{description}</p>
                  </div>
                  <button
                    onClick={() => setNotifs((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${notifs[key] ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-1 transition-transform ${notifs[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // billing/security fallback
  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8 pt-16" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={() => setSection('main')} className="text-sm text-[#6366F1] font-medium mb-6 hover:underline">
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-[#0F172A] mb-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          {section === 'billing' ? 'Billing & Wallet' : 'Privacy & Security'}
        </h1>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-[#64748B] text-sm">This section is coming soon.</p>
        </div>
      </div>
    </div>
  )
}
