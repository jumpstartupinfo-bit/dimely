import { useState } from 'react'
import { ChevronRight, CheckCircle2, Video, Mic, Loader2, Eye, EyeOff } from 'lucide-react'
import { Logo } from '../components/Logo'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../lib/api'
import type { Page } from '../App'

interface OnboardingPageProps {
  returnTo?: { page: Page; username?: string }
  onNavigate: (page: Page, username?: string) => void
}

type Step = 'start' | 'signup' | 'name' | 'category' | 'pricing' | 'done'

const CATEGORIES = [
  'Creator', 'Founder', 'Consultant', 'Coach', 'Athlete', 'Musician',
  'Entertainer', 'Influencer', 'Educator', 'Professional', 'Other'
]

const STEPS: Step[] = ['start', 'signup', 'name', 'category', 'pricing', 'done']

export function OnboardingPage({ onNavigate, returnTo }: OnboardingPageProps) {
  const { signup, login, refreshMe } = useAuth()
  // When navigated here mid-flow (e.g. from booking auth gate), skip the start screen
  const [step, setStep] = useState<Step>(returnTo ? 'signup' : 'start')
  const [mode, setMode] = useState<'signup' | 'login'>(returnTo ? 'login' : 'signup')

  // Signup fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

  // Profile fields
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [headline, setHeadline] = useState('')
  const [category, setCategory] = useState('')
  const [pricePerMin, setPricePerMin] = useState('5')
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [voiceEnabled, setVoiceEnabled] = useState(true)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function next() {
    setError(null)
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  async function handleAuth() {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      if (mode === 'login') {
        await login(email.trim(), password)
        if (returnTo) onNavigate(returnTo.page, returnTo.username)
        else onNavigate('discover')
      } else {
        // For signup we collect more info first
        next()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!name.trim() || !username.trim() || !category || !pricePerMin) {
      setError('Please fill in all required fields')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await signup({
        email: email.trim(),
        password,
        name: name.trim(),
        username: username.trim().toLowerCase(),
        inviteCode: inviteCode.trim() || undefined,
        headline: headline.trim(),
        category,
        pricePerMin: parseFloat(pricePerMin),
        videoEnabled,
        voiceEnabled,
      })
      // After signup, update profile with additional details
      await refreshMe()
      setStep('done')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create your account. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    if (step === 'signup') return email.trim() !== '' && password.length >= 8
    if (step === 'name') return name.trim() !== '' && username.trim() !== '' && headline.trim() !== ''
    if (step === 'category') return category !== ''
    if (step === 'pricing') return pricePerMin !== '' && Number(pricePerMin) > 0
    return true
  }

  if (step === 'start') {
    return (
      <div className="min-h-dvh bg-white flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="h-14 flex items-center px-4 border-b border-gray-100">
          <Logo size="sm" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-md mx-auto w-full text-center">
          <h1
            className="text-4xl font-bold text-[#0F172A] mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            Create your Dimely
          </h1>
          <p className="text-lg text-[#64748B] mb-10">
            Put a price on your time. Share your link. Get booked.
          </p>
          <div className="w-full space-y-3">
            <button
              onClick={() => { setMode('signup'); next() }}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-4 rounded-2xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200"
            >
              Get started
            </button>
            <button
              onClick={() => { setMode('login'); next() }}
              className="w-full border border-gray-200 text-[#0F172A] font-medium py-4 rounded-2xl text-base hover:bg-gray-50 transition-colors"
            >
              Sign in
            </button>
          </div>
          <p className="text-xs text-[#64748B] mt-6 leading-relaxed">
            By creating an account you agree to Dimely's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-4" style={{ fontFamily: "'DM Sans', sans-serif" }}>
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 rounded-full bg-[#E0E7FF] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-[#6366F1]" />
          </div>
          <h1
            className="text-3xl font-bold text-[#0F172A] mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
          >
            You're live!
          </h1>
          <p className="text-[#64748B] mb-2">Your Dimely page is ready at:</p>
          <div className="bg-[#E0E7FF] rounded-xl px-4 py-2.5 mb-8 inline-block">
            <p className="text-[#6366F1] font-bold">dimely.com/{username || 'you'}</p>
          </div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => onNavigate('discover')}
              className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-4 rounded-2xl transition-all"
            >
              Explore Dimely
            </button>
            <button
              onClick={() => onNavigate('profile', username || 'you')}
              className="w-full border border-gray-200 text-[#0F172A] font-medium py-4 rounded-2xl hover:bg-gray-50 transition-colors"
            >
              View my page
            </button>
          </div>
        </div>
      </div>
    )
  }

  const stepLabel: Record<Step, string> = {
    start: '', signup: mode === 'login' ? 'Sign in' : 'Create account', name: 'About you', category: 'Your category', pricing: 'Your pricing', done: '',
  }
  const stepIdx = STEPS.indexOf(step)
  const progress = (stepIdx / (STEPS.length - 2)) * 100

  return (
    <div className="min-h-dvh bg-white flex flex-col" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100">
        <Logo size="sm" />
        <p className="text-sm text-[#64748B] font-medium">{stepLabel[step]}</p>
        <button onClick={() => onNavigate('landing')} className="text-sm text-[#64748B] hover:text-[#0F172A]">Cancel</button>
      </div>

      <div className="h-1 bg-gray-100">
        <div className="h-full bg-[#6366F1] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        {/* Step: Signup / Login */}
        {step === 'signup' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-[#64748B] mb-6">
              {mode === 'login' ? 'Sign in to your Dimely account' : 'Join Dimely in seconds'}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                    className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-4 pr-12 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {mode === 'signup' && (
                <div>
                  <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">
                    Invite code <span className="font-normal text-[#64748B] normal-case">(required if you have one)</span>
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="DIMELY-XXXXX-XXXX"
                    className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] uppercase tracking-wider"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Name */}
        {step === 'name' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Tell us about yourself
            </h2>
            <p className="text-sm text-[#64748B] mb-6">This is what people will see on your Dimely page</p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] text-sm">dimely.com/</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '-').replace(/[^a-z0-9-]/g, ''))}
                    placeholder="yourname"
                    className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] pl-28 pr-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Headline</label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Creator & Entrepreneur"
                  className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-4 py-3.5 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Category */}
        {step === 'category' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              What best describes you?
            </h2>
            <p className="text-sm text-[#64748B] mb-6">This helps people discover you</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`flex items-center gap-2 p-4 rounded-2xl border-2 text-sm font-semibold transition-all text-left ${
                    category === cat
                      ? 'border-[#6366F1] bg-[#E0E7FF] text-[#6366F1]'
                      : 'border-gray-100 bg-white text-[#0F172A] hover:border-[#A5B4FC]'
                  }`}
                >
                  {category === cat && <CheckCircle2 size={14} className="text-[#6366F1] flex-shrink-0" />}
                  {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Pricing */}
        {step === 'pricing' && (
          <div>
            <h2 className="text-2xl font-bold text-[#0F172A] mb-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Set your price
            </h2>
            <p className="text-sm text-[#64748B] mb-6">How much do you charge per minute?</p>

            <div className="mb-6">
              <label className="text-xs font-semibold text-[#64748B] uppercase tracking-wider block mb-2">Price per minute</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#64748B] font-bold text-xl">$</span>
                <input
                  type="number"
                  value={pricePerMin}
                  onChange={(e) => setPricePerMin(e.target.value)}
                  min="1"
                  max="500"
                  className="w-full bg-[#F8FAFC] border border-gray-200 text-[#0F172A] pl-10 pr-4 py-5 rounded-2xl text-2xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[#64748B] text-sm">/min</span>
              </div>
            </div>

            {pricePerMin && Number(pricePerMin) > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-6">
                {[15, 30, 45, 60].map((d) => (
                  <div key={d} className="bg-[#F8FAFC] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A] tabular-nums">${Number(pricePerMin) * d}</p>
                    <p className="text-xs text-[#64748B]">{d} min</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-[#E0E7FF] rounded-2xl p-4 mb-6 text-xs text-[#6366F1]">
              You keep <span className="font-bold">80%</span> of every booking. Dimely's platform fee is 20%.
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Call types</p>
              {[
                { key: 'video', label: 'Video calls', icon: Video, state: videoEnabled, toggle: setVideoEnabled },
                { key: 'voice', label: 'Voice calls', icon: Mic, state: voiceEnabled, toggle: setVoiceEnabled },
              ].map(({ key, label, icon: Icon, state, toggle }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#E0E7FF] flex items-center justify-center">
                      <Icon size={16} className="text-[#6366F1]" />
                    </div>
                    <span className="text-sm font-semibold text-[#0F172A]">{label}</span>
                  </div>
                  <button
                    onClick={() => toggle(!state)}
                    className={`w-10 h-6 rounded-full transition-colors ${state ? 'bg-[#6366F1]' : 'bg-gray-200'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm mx-1 transition-transform ${state ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {step === 'pricing' ? (
          <button
            onClick={() => { void handleCreate() }}
            disabled={!canProceed() || loading}
            className={`w-full mt-8 py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
              canProceed() && !loading
                ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:shadow-lg hover:shadow-indigo-200'
                : 'bg-gray-100 text-[#64748B] cursor-not-allowed'
            }`}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Creating your Dimely...</>
            ) : (
              <>Create my Dimely <ChevronRight size={18} /></>
            )}
          </button>
        ) : step === 'signup' ? (
          <button
            onClick={() => { void handleAuth() }}
            disabled={!canProceed() || loading}
            className={`w-full mt-8 py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
              canProceed() && !loading
                ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:shadow-lg hover:shadow-indigo-200'
                : 'bg-gray-100 text-[#64748B] cursor-not-allowed'
            }`}
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> {mode === 'login' ? 'Signing in...' : 'Continuing...'}</>
            ) : (
              <>{mode === 'login' ? 'Sign in' : 'Continue'} <ChevronRight size={18} /></>
            )}
          </button>
        ) : (
          <button
            onClick={next}
            disabled={!canProceed()}
            className={`w-full mt-8 py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 transition-all ${
              canProceed()
                ? 'bg-[#6366F1] hover:bg-[#4F46E5] text-white hover:shadow-lg hover:shadow-indigo-200'
                : 'bg-gray-100 text-[#64748B] cursor-not-allowed'
            }`}
          >
            Continue <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  )
}
