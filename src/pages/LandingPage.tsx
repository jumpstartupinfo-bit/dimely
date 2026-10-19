import type { Page } from '../App'
import { useState } from 'react'
import {
  Shield,
  Zap,
  Users,
  Star,
  ChevronRight,
  CheckCircle2,
  Play,
  ArrowRight,
} from 'lucide-react'
import { Logo } from '../components/Logo'
import { useEffect, useState as useStateProfiles } from 'react'
import { profiles as profilesApi, type Profile } from '../lib/api'



interface LandingPageProps {
  onNavigate: (page: Page, username?: string) => void
}

const CATEGORY_EXAMPLES = [
  { label: 'Creators', icon: Star, color: '#6366F1', people: ['Aisha Kim', 'Camila Torres'] },
  { label: 'Celebrities', icon: Star, color: '#EC4899', people: ['Public figures', 'Fan access'] },
  { label: 'Athletes', icon: Zap, color: '#F59E0B', people: ['Sofia Reyes', 'Sports stars'] },
  { label: 'Musicians', icon: Play, color: '#8B5CF6', people: ['Devin Wells', 'Private sessions'] },
  { label: 'Professionals', icon: Shield, color: '#059669', people: ['Priya Sharma', 'Alex Cho'] },
  { label: 'Coaches', icon: Users, color: '#0891B2', people: ['Yuna Park', 'Rafe Hampton'] },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Discover someone',
    body: 'Browse our directory or search for exactly who you want to talk to. Creators, coaches, athletes, professionals — they\'re all here.',
  },
  {
    step: '02',
    title: 'Pick a time',
    body: 'Choose a date, time, and duration that works for you. 15, 30, 45, or 60 minutes. Voice or video.',
  },
  {
    step: '03',
    title: 'Pay securely',
    body: 'Your payment is held securely until the call completes. You\'re protected every step of the way.',
  },
  {
    step: '04',
    title: 'Have the call',
    body: 'Join directly from the app. Talk. Learn. Connect. Get access to people you couldn\'t reach before.',
  },
]

const STATS = [
  { value: '12K+', label: 'People bookable' },
  { value: '94K+', label: 'Calls completed' },
  { value: '140+', label: 'Countries' },
  { value: '4.9', label: 'Avg. experience' },
]

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [aiQuery, setAiQuery] = useState('')
  const [featuredPeople, setFeaturedPeople] = useStateProfiles<Profile[]>([])

  useEffect(() => {
    void profilesApi.list({ limit: 6 }).then(r => { setFeaturedPeople(r.profiles) }).catch(() => {})
  }, [])

  function handleAiSearch(e: React.FormEvent) {
    e.preventDefault()
    onNavigate('discover')
  }

  return (
    <div className="min-h-dvh bg-white" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Hero */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#E0E7FF] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <Zap size={12} />
              Now live in 140+ countries
            </div>
            <h1
              className="text-5xl sm:text-6xl font-bold leading-tight mb-6"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
            >
              Book anyone.{' '}
              <span className="text-[#6366F1]">Anywhere.</span>
            </h1>
            <p className="text-lg text-[#64748B] leading-relaxed mb-8 max-w-lg" style={{ textWrap: 'pretty' }}>
              Put a price on your time. Share your Dimely link.
              Let anyone in the world book you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <button
                onClick={() => onNavigate('onboarding')}
                className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-7 py-4 rounded-2xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
              >
                Create your Dimely
              </button>
              <button
                onClick={() => onNavigate('discover')}
                className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-[#0F172A] font-semibold px-7 py-4 rounded-2xl text-base hover:bg-gray-50 transition-colors"
              >
                Discover people
                <ArrowRight size={16} />
              </button>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-2">
                {['#6366F1', '#EC4899', '#F59E0B', '#059669', '#0891B2'].map((color, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-semibold"
                    style={{ backgroundColor: color }}
                  >
                    {['AK', 'SR', 'JO', 'PS', 'LR'][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-[#64748B]">
                <span className="font-semibold text-[#0F172A]">12,000+</span> people available to book today
              </p>
            </div>
          </div>

          {/* Right — hero card stack */}
          <div className="relative flex justify-center lg:justify-end overflow-visible">
            <div className="relative w-full max-w-sm pb-8">
              {/* Main profile card */}
              <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 relative z-10">
                {/* Profile header */}
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-[#6366F1] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    AK
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-[#0F172A]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Aisha Kim
                      </p>
                      <CheckCircle2 size={14} className="text-[#6366F1] flex-shrink-0" fill="#6366F1" color="white" />
                    </div>
                    <p className="text-sm text-[#64748B]">Creator & Musician</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Nairobi, Kenya</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#0F172A] tabular-nums">$4/min</p>
                    <p className="text-xs text-[#64748B]">Video</p>
                  </div>
                </div>

                {/* Availability badge */}
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-medium text-emerald-600">Available today</span>
                  <span className="text-xs text-[#64748B] ml-auto">128 bookings</span>
                </div>

                {/* Mini calendar */}
                <div className="bg-[#F8FAFC] rounded-2xl p-4 mb-5">
                  <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3">April 2025</p>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                      <div key={i} className="text-xs text-[#64748B] font-medium py-1">{d}</div>
                    ))}
                    {[null, null, null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((d, i) => (
                      <div
                        key={i}
                        className={`text-xs py-1.5 rounded-lg font-medium ${
                          d === 18
                            ? 'bg-[#6366F1] text-white'
                            : d && [15, 16, 19, 22, 23].includes(d)
                            ? 'bg-[#E0E7FF] text-[#6366F1]'
                            : d
                            ? 'text-[#0F172A] hover:bg-gray-100'
                            : ''
                        }`}
                      >
                        {d || ''}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Time slots */}
                <div className="flex gap-2 mb-5">
                  {['11:00 AM', '1:30 PM', '3:00 PM'].map((t) => (
                    <button
                      key={t}
                      className={`flex-1 text-xs font-semibold py-2.5 rounded-xl transition-colors ${
                        t === '1:30 PM'
                          ? 'bg-[#6366F1] text-white'
                          : 'bg-[#F8FAFC] text-[#64748B] hover:bg-[#E0E7FF] hover:text-[#6366F1]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => onNavigate('discover')}
                  className="w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3.5 rounded-2xl text-sm transition-all hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
                >
                  Book a call
                </button>
              </div>

              {/* Floating confirmation card */}
              <div className="absolute -bottom-6 -right-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 flex items-center gap-3 z-20 max-w-[200px]">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F172A]">Booking confirmed!</p>
                  <p className="text-xs text-[#64748B]">Apr 18 · 1:30 PM</p>
                </div>
              </div>

              {/* Floating earnings card */}
              <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-xl border border-gray-100 p-3.5 flex items-center gap-3 z-20">
                <div className="w-9 h-9 rounded-xl bg-[#E0E7FF] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#6366F1] font-bold text-sm">$</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#0F172A] tabular-nums">+$96 earned</p>
                  <p className="text-xs text-[#64748B]">Paid to wallet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-[#F8FAFC] border-y border-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p
                className="text-3xl font-bold text-[#0F172A] tabular-nums"
                style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
              >
                {value}
              </p>
              <p className="text-sm text-[#64748B] mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Discovery section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-[#E0E7FF] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap size={12} />
          AI-powered discovery
        </div>
        <h2
          className="text-4xl sm:text-5xl font-bold mb-4"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
        >
          Find someone worth talking to.
        </h2>
        <p className="text-lg text-[#64748B] mb-10">
          Just describe who you want to talk to. Our AI finds the right person.
        </p>
        <form onSubmit={handleAiSearch} className="relative max-w-2xl mx-auto mb-8">
          <input
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Find a fitness creator available this week..."
            className="w-full bg-white border border-gray-200 text-[#0F172A] placeholder-[#64748B] px-6 py-4 pr-36 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap justify-center gap-2">
          {[
            'Find a musician who offers private calls',
            'Find an athlete available this week',
            'Find someone under $100 for 30 min',
            'Find a marketing expert available today',
          ].map((q) => (
            <button
              key={q}
              onClick={() => onNavigate('discover')}
              className="text-xs bg-white border border-gray-200 text-[#64748B] px-4 py-2 rounded-xl hover:border-[#6366F1] hover:text-[#6366F1] transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </section>

      {/* Category showcase */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="categories">
        <div className="text-center mb-12">
          <h2
            className="text-4xl font-bold text-[#0F172A] mb-3"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            Different people. Real time.
          </h2>
          <p className="text-lg text-[#64748B]">The directory isn't limited. Neither is the conversation.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
          {CATEGORY_EXAMPLES.map(({ label, icon: Icon, color }) => (
            <button
              key={label}
              onClick={() => onNavigate('discover')}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col items-center gap-3 hover:border-[#6366F1] hover:shadow-md transition-all group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: color + '15' }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <span className="text-sm font-semibold text-[#0F172A] group-hover:text-[#6366F1] transition-colors">
                {label}
              </span>
            </button>
          ))}
        </div>

        {/* Featured people */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {featuredPeople.map((person) => (
            <button
              key={person.id}
              onClick={() => onNavigate('profile', person.username)}
              className="bg-white border border-gray-100 rounded-2xl p-5 flex items-start gap-4 hover:shadow-md hover:border-[#6366F1] transition-all text-left group"
            >
              {person.photo_url
                ? <img src={person.photo_url} alt={person.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: person.avatar_color }}>{person.avatar_initials}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-semibold text-[#0F172A] text-sm truncate">{person.name}</p>
                  {person.verified && (
                    <CheckCircle2 size={13} className="text-[#6366F1] flex-shrink-0" fill="#6366F1" color="white" />
                  )}
                </div>
                <p className="text-xs text-[#64748B] truncate mb-2">{person.headline}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-[#0F172A] tabular-nums">${person.price_per_min}/min</span>
                  {person.available_today && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      Available today
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 group-hover:text-[#6366F1] flex-shrink-0 mt-1 transition-colors" />
            </button>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => onNavigate('discover')}
            className="inline-flex items-center gap-2 text-[#6366F1] font-semibold hover:underline"
          >
            See all people
            <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]" id="how-it-works">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="text-4xl font-bold text-[#0F172A] mb-3"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
            >
              Book. Pay. Talk.
            </h2>
            <p className="text-lg text-[#64748B]">Simple for everyone.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="w-10 h-10 rounded-xl bg-[#E0E7FF] flex items-center justify-center mb-4">
                  <span
                    className="text-xs font-bold text-[#6366F1]"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {step}
                  </span>
                </div>
                <h3
                  className="font-bold text-[#0F172A] mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {title}
                </h3>
                <p className="text-sm text-[#64748B] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For hosts section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#E0E7FF] text-[#6366F1] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              For people with time to sell
            </div>
            <h2
              className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-6"
              style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
            >
              Turn your time into income. Anywhere.
            </h2>
            <p className="text-lg text-[#64748B] mb-8 leading-relaxed">
              Create your Dimely page in minutes. Set your price. Share your link. 
              Let people all over the world book time with you — and get paid instantly.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                'You keep 80% of every booking',
                'Your AI agent handles bookings when you\'re busy',
                'One link works everywhere — Instagram, WhatsApp, X, TikTok',
                'Payments are held securely and released after each call',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 size={18} className="text-[#6366F1] flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-[#0F172A]">{item}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => onNavigate('onboarding')}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-7 py-4 rounded-2xl text-base transition-all hover:shadow-lg hover:shadow-indigo-200"
            >
              Create your Dimely
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: '$4,200', label: 'Earned this month', sub: 'Marcus Chen · Founder', color: '#0F172A' },
              { value: '$1,840', label: 'Earned this month', sub: 'Aisha Kim · Creator', color: '#6366F1' },
              { value: '$2,960', label: 'Earned this month', sub: 'Priya Sharma · Finance', color: '#059669' },
              { value: '$1,200', label: 'Referral earnings', sub: '12 months · 20% commission', color: '#8B5CF6' },
            ].map(({ value, label, sub, color }) => (
              <div key={value + sub} className="bg-white border border-gray-100 rounded-2xl p-5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: color + '15' }}
                >
                  <DollarSign size={18} style={{ color }} />
                </div>
                <p
                  className="text-2xl font-bold text-[#0F172A] tabular-nums mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}
                >
                  {value}
                </p>
                <p className="text-xs font-medium text-[#64748B]">{label}</p>
                <p className="text-xs text-[#64748B] mt-1">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Invite & Earn */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#6366F1]">
        <div className="max-w-4xl mx-auto text-center">
          <h2
            className="text-4xl sm:text-5xl font-bold text-white mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
          >
            Invite your friends.{' '}
            <span className="text-[#A5B4FC]">Earn 20%.</span>
          </h2>
          <p className="text-lg text-[#A5B4FC] mb-10">
            Earn 20% of our platform revenue from everyone you invite — for their first 12 months.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => onNavigate('onboarding')}
              className="bg-white hover:bg-[#F8FAFC] text-[#6366F1] font-semibold px-8 py-4 rounded-2xl text-base transition-colors"
            >
              Start inviting
            </button>
            <button
              onClick={() => onNavigate('discover')}
              className="text-white font-medium hover:text-[#A5B4FC] transition-colors"
            >
              Learn how it works →
            </button>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center">
        <h2
          className="text-5xl sm:text-6xl font-bold text-[#0F172A] mb-6"
          style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.03em' }}
        >
          Book anyone.{' '}
          <span className="text-[#6366F1]">Anywhere.</span>
        </h2>
        <p className="text-xl text-[#64748B] mb-10">
          Dimely turns your time into something anyone can discover, book, and pay for.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onNavigate('onboarding')}
            className="bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold px-8 py-4 rounded-2xl text-lg transition-all hover:shadow-xl hover:shadow-indigo-200"
          >
            Create your Dimely
          </button>
          <button
            onClick={() => onNavigate('discover')}
            className="flex items-center justify-center gap-2 border border-gray-200 text-[#0F172A] font-semibold px-8 py-4 rounded-2xl text-lg hover:bg-gray-50 transition-colors"
          >
            Discover people
            <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center gap-6 text-sm text-[#64748B]">
              <a href="#" className="hover:text-[#0F172A] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#0F172A] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#0F172A] transition-colors">Support</a>
              <a href="#" className="hover:text-[#0F172A] transition-colors">Blog</a>
            </div>
            <p className="text-sm text-[#64748B]">© 2026 Dimely. Book anyone. Anywhere.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DollarSign({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}
