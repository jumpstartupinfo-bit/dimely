import type { Page } from '../App'
import { useState, useEffect, useCallback } from 'react'
import { Search, Mic, Video, CheckCircle2, MapPin, Zap, SlidersHorizontal, X, Bot, AlertCircle } from 'lucide-react'
import { profiles as profilesApi, type Profile } from '../lib/api'
import { useAuth } from '../context/AuthContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Business',
  'Technology',
  'Finance',
  'Marketing',
  'Design',
  'Legal',
  'Education',
  'Career',
  'Health & Wellness',
  'Creators',
  'Founders',
  'Consultants',
  'Coaches',
  'Athletes',
  'Musicians',
  'Entertainers',
  'Influencers',
]

const BADGE_STYLES: Record<string, string> = {
  Popular: 'bg-[#E0E7FF] text-[#6366F1]',
  Trending: 'bg-orange-50 text-orange-600',
  New: 'bg-emerald-50 text-emerald-600',
  'Fast responder': 'bg-sky-50 text-sky-600',
  'Available today': 'bg-emerald-50 text-emerald-600',
}

const AI_SUGGESTIONS = [
  'Find a fitness creator I can talk to',
  'Find a musician who offers private calls',
  'Find an athlete available this week',
  'Find someone under $100 for 30 minutes',
  'Find a marketing expert available today',
  'Find an influencer who talks about skincare',
  'Find someone who can help me prep for an interview',
]

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        <div className="h-6 bg-gray-100 rounded-lg w-16" />
        <div className="h-6 bg-gray-100 rounded-lg w-20" />
        <div className="h-6 bg-gray-100 rounded-lg w-14" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-2/3 mb-4" />
      <div className="h-11 bg-gray-100 rounded-xl" />
    </div>
  )
}

// ─── Profile card ─────────────────────────────────────────────────────────────

function profileBadge(p: Profile): string | null {
  if (p.available_today) return 'Available today'
  if (p.booking_count > 200) return 'Popular'
  if (p.verified) return null
  return null
}

interface PersonCardProps {
  profile: Profile
  onNavigate: (page: Page, username?: string) => void
}

function PersonCard({ profile, onNavigate }: PersonCardProps) {
  const badge = profileBadge(profile)
  return (
    <div
      onClick={() => onNavigate('profile', profile.username)}
      className="bg-white border border-gray-100 rounded-2xl p-5 hover:shadow-lg hover:border-[#A5B4FC] transition-all cursor-pointer group flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 text-sm overflow-hidden"
          style={{ backgroundColor: profile.avatar_color }}
        >
          {profile.photo_url
            ? <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
            : profile.avatar_initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="font-bold text-[#0F172A] text-sm"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {profile.name}
            </p>
            {!!profile.verified && (
              <CheckCircle2 size={13} className="text-[#6366F1] flex-shrink-0" fill="#6366F1" color="white" />
            )}
            {badge && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${BADGE_STYLES[badge] ?? 'bg-gray-100 text-[#64748B]'}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-xs text-[#64748B] truncate">{profile.headline}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin size={10} className="text-[#64748B]" />
            <p className="text-xs text-[#64748B] truncate">{profile.location}</p>
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(profile.tags ?? []).slice(0, 3).map((tag) => (
          <span key={tag} className="text-xs bg-[#F8FAFC] text-[#64748B] px-2.5 py-1 rounded-lg">
            {tag}
          </span>
        ))}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 mb-4 text-xs text-[#64748B] flex-wrap">
        <div className="flex items-center gap-1 flex-shrink-0">
          {!!profile.video_available && <Video size={12} className="text-[#6366F1]" />}
          {!!profile.voice_available && <Mic size={12} className="text-[#6366F1]" />}
          <span className="font-semibold text-[#0F172A] tabular-nums ml-1">${profile.price_per_min}/min</span>
        </div>
        <span className="flex-shrink-0">·</span>
        <span className="flex-shrink-0">{profile.booking_count} bookings</span>
        {profile.available_today ? (
          <>
            <span className="flex-shrink-0">·</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-emerald-600 font-medium">Available today</span>
            </div>
          </>
        ) : profile.next_available ? (
          <>
            <span className="flex-shrink-0">·</span>
            <span className="truncate max-w-[120px]">{profile.next_available}</span>
          </>
        ) : null}
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onNavigate('booking', profile.username) }}
        className="mt-auto w-full bg-[#6366F1] hover:bg-[#4F46E5] text-white font-semibold py-3 rounded-xl text-sm transition-all group-hover:shadow-md group-hover:shadow-indigo-100 active:scale-[0.98]"
      >
        Book a call
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

interface DiscoverPageProps {
  onNavigate: (page: Page, username?: string) => void
}

export function DiscoverPage({ onNavigate }: DiscoverPageProps) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [aiMode, setAiMode] = useState(false)
  const [aiQuery, setAiQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [availableFilter, setAvailableFilter] = useState(false)
  const [videoFilter, setVideoFilter] = useState(false)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)

  const [results, setResults] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfiles = useCallback(async (opts: {
    q?: string
    category?: string
    availableToday?: boolean
    video?: boolean
    maxPrice?: number | null
  }) => {
    setLoading(true)
    setError(null)
    try {
      const data = await profilesApi.list({
        q: opts.q || undefined,
        category: opts.category !== 'All' ? opts.category : undefined,
        availableToday: opts.availableToday || undefined,
        video: opts.video || undefined,
        maxPrice: opts.maxPrice ?? undefined,
      })
      // Exclude the logged-in user's own profile
      setResults(data.profiles.filter((p) => !user || p.username !== user.username))
    } catch {
      setError('Something went wrong loading people. Please try again.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial load
  useEffect(() => {
    async function init() { await fetchProfiles({}) }
    void init()
  }, [fetchProfiles])

  // Re-fetch whenever filters change (debounced for text input)
  useEffect(() => {
    const activeQuery = aiMode ? aiQuery : query
    const params = {
      q: activeQuery || undefined,
      category: activeCategory,
      availableToday: availableFilter,
      video: videoFilter,
      maxPrice,
    }
    const timer = setTimeout(() => {
      async function run() { await fetchProfiles(params) }
      void run()
    }, activeQuery ? 400 : 0) // debounce text; instant for filter toggles
    return () => clearTimeout(timer)
  }, [query, aiQuery, activeCategory, aiMode, availableFilter, videoFilter, maxPrice, fetchProfiles])

  const availableTodayCount = results.filter((p) => p.available_today).length

  return (
    <div className="min-h-dvh bg-[#F8FAFC] pb-24 md:pb-8" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Top search bar */}
      <div className="sticky top-16 z-30 bg-[#F8FAFC] border-b border-gray-100 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          {/* Search input */}
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" />
              <input
                type="text"
                value={aiMode ? aiQuery : query}
                onChange={(e) => { if (aiMode) setAiQuery(e.target.value); else setQuery(e.target.value) }}
                placeholder={aiMode ? 'Ask anything... "Find a fitness creator available tonight"' : 'Search people, skills, topics...'}
                className="w-full bg-white border border-gray-200 text-[#0F172A] placeholder-[#64748B] pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:border-transparent"
              />
            </div>
            <button
              onClick={() => { setAiMode(!aiMode); setQuery(''); setAiQuery('') }}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors flex-shrink-0 ${
                aiMode ? 'bg-[#6366F1] text-white' : 'bg-white border border-gray-200 text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]'
              }`}
            >
              <Bot size={16} />
              <span className="hidden sm:inline">AI</span>
            </button>
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors flex-shrink-0 ${
                filtersOpen || availableFilter || videoFilter || maxPrice
                  ? 'bg-[#E0E7FF] text-[#6366F1]'
                  : 'bg-white border border-gray-200 text-[#64748B]'
              }`}
            >
              <SlidersHorizontal size={16} />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>

          {/* AI suggestions */}
          {aiMode && !aiQuery && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none mb-3">
              {AI_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setAiQuery(s)}
                  className="text-xs bg-white border border-gray-200 text-[#64748B] px-3 py-2 rounded-xl whitespace-nowrap hover:border-[#6366F1] hover:text-[#6366F1] transition-colors flex-shrink-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Filters panel */}
          {filtersOpen && (
            <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableFilter}
                  onChange={(e) => setAvailableFilter(e.target.checked)}
                  className="accent-[#6366F1] w-4 h-4"
                />
                <span className="text-sm font-medium text-[#0F172A]">Available today</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={videoFilter}
                  onChange={(e) => setVideoFilter(e.target.checked)}
                  className="accent-[#6366F1] w-4 h-4"
                />
                <span className="text-sm font-medium text-[#0F172A]">Video calls</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#0F172A]">Max 30-min price:</span>
                <select
                  value={maxPrice ?? ''}
                  onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
                  className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
                >
                  <option value="">Any</option>
                  <option value="50">Under $50</option>
                  <option value="100">Under $100</option>
                  <option value="200">Under $200</option>
                  <option value="300">Under $300</option>
                </select>
              </div>
              {(availableFilter || videoFilter || maxPrice) && (
                <button
                  onClick={() => { setAvailableFilter(false); setVideoFilter(false); setMaxPrice(null) }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 ml-auto"
                >
                  <X size={12} />
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs font-semibold px-4 py-2 rounded-xl whitespace-nowrap flex-shrink-0 transition-colors ${
                  activeCategory === cat
                    ? 'bg-[#6366F1] text-white'
                    : 'bg-white border border-gray-200 text-[#64748B] hover:border-[#6366F1] hover:text-[#6366F1]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {!loading && !error && (
          <div className="flex items-center justify-between mb-5">
            <h2
              className="text-xl font-bold text-[#0F172A]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {aiMode && aiQuery ? (
                <span>Results for "<span className="text-[#6366F1]">{aiQuery}</span>"</span>
              ) : activeCategory !== 'All' ? (
                activeCategory
              ) : (
                'Find someone worth talking to.'
              )}
            </h2>
            <span className="text-sm text-[#64748B]">{results.length} people</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={28} className="text-red-400" />
            </div>
            <p className="font-bold text-[#0F172A] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Something went wrong
            </p>
            <p className="text-sm text-[#64748B] mb-4">Something went wrong loading people. Please try again.</p>
            <button
              onClick={() => void fetchProfiles({
                q: (aiMode ? aiQuery : query) || undefined,
                category: activeCategory,
                availableToday: availableFilter,
                video: videoFilter,
                maxPrice,
              })}
              className="text-sm bg-[#6366F1] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#4F46E5] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Skeleton loading */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && results.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-[#E0E7FF] flex items-center justify-center mx-auto mb-4">
              <Search size={28} className="text-[#6366F1]" />
            </div>
            <p className="font-bold text-[#0F172A] mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              No results found
            </p>
            <p className="text-sm text-[#64748B] mb-4">Try a different search or category</p>
            <button
              onClick={() => { setQuery(''); setAiQuery(''); setActiveCategory('All'); setAvailableFilter(false); setVideoFilter(false); setMaxPrice(null) }}
              className="text-sm text-[#6366F1] font-semibold hover:underline"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && results.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {results.map((profile) => (
                <PersonCard key={profile.id} profile={profile} onNavigate={onNavigate} />
              ))}
            </div>

            {/* Available today callout */}
            {!availableFilter && availableTodayCount > 0 && (
              <div className="mt-8 bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <Zap size={18} className="text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-700">
                  <span className="font-semibold">{availableTodayCount} {availableTodayCount === 1 ? 'person' : 'people'}</span>{' '}
                  {availableTodayCount === 1 ? 'is' : 'are'} available today. Book now and call within hours.
                </p>
                <button
                  onClick={() => setAvailableFilter(true)}
                  className="ml-auto text-xs font-semibold text-emerald-700 hover:underline flex-shrink-0"
                >
                  Show only
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
