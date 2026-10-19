import { useState, useRef, useEffect } from 'react'
import {
  Compass,
  Calendar,
  BookOpen,
  DollarSign,
  Bell,
  User,
  Bot,
  UserPlus,
  Settings,
  LogOut,
  ChevronDown,
  X,
  Menu,
  LayoutDashboard,
} from 'lucide-react'
import { Logo } from './Logo'
import { useAuth } from '../context/AuthContext'

export type Page =
  | 'landing'
  | 'discover'
  | 'profile'
  | 'booking'
  | 'calendar'
  | 'bookings'
  | 'earnings'
  | 'settings'
  | 'invite'
  | 'ai-agent'
  | 'notifications'
  | 'call'
  | 'onboarding'
  | 'admin'

interface NavProps {
  currentPage: Page
  onNavigate: (page: Page, username?: string) => void
  isLoggedIn: boolean
  onLogout: () => void
}

const NAV_ITEMS = [
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'bookings', label: 'Bookings', icon: BookOpen },
  { id: 'earnings', label: 'Earnings', icon: DollarSign },
]

export function Nav({ currentPage, onNavigate, isLoggedIn, onLogout }: NavProps) {
  const { user, profile } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Real unread count from context (placeholder for now — wired in NotificationsPage)
  const unreadCount = 0

  const displayName = user?.name ?? 'Your account'
  const displayUsername = profile?.username ?? user?.username ?? 'you'
  const initials = (user?.name ?? 'YO').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  const avatarColor = profile?.avatar_color ?? '#6366F1'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const isApp = currentPage !== 'landing'

  if (!isApp) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate('landing')} className="flex items-center">
            <Logo size="sm" />
          </button>
          <nav className="hidden md:flex items-center gap-8">
            <button
              onClick={() => onNavigate('discover')}
              className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              Discover
            </button>
            <a href="#how-it-works" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              How it works
            </a>
            <a href="#pricing" className="text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <button
              onClick={isLoggedIn ? () => onNavigate('discover') : () => onNavigate('onboarding')}
              className="hidden md:block text-sm font-medium text-[#64748B] hover:text-[#0F172A] transition-colors px-4 py-2"
            >
              {isLoggedIn ? 'Dashboard' : 'Sign in'}
            </button>
            <button
              onClick={isLoggedIn ? () => onNavigate('discover') : () => onNavigate('onboarding')}
              className="bg-[#6366F1] hover:bg-[#4F46E5] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
            >
              {isLoggedIn ? 'Go to app' : 'Create your Dimely'}
            </button>
          </div>
        </div>
      </header>
    )
  }

  return (
    <>
      {/* Desktop top nav */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => onNavigate('landing')} className="flex items-center">
            <Logo size="sm" />
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = currentPage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id as Page)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-[#E0E7FF] text-[#6366F1]' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            {/* Notifications */}
            <button
              onClick={() => onNavigate('notifications')}
              className={`relative p-2.5 rounded-xl transition-colors ${
                currentPage === 'notifications' ? 'bg-[#E0E7FF] text-[#6366F1]' : 'text-[#64748B] hover:text-[#0F172A] hover:bg-gray-50'
              }`}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#6366F1] rounded-full" />
              )}
            </button>

            {/* Profile dropdown */}
            <div className="relative hidden md:block" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                  style={{ backgroundColor: avatarColor }}
                >
                  {initials}
                </div>
                <ChevronDown size={14} className="text-[#64748B]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-2 border-b border-gray-100 mb-1">
                    <p className="text-sm font-semibold text-[#0F172A]">{displayName}</p>
                    <p className="text-xs text-[#64748B]">dimely.com/{displayUsername}</p>
                  </div>
                  {[
                    { label: 'My Dimely', icon: User, page: 'profile' as Page, username: displayUsername },
                    { label: 'My AI Agent', icon: Bot, page: 'ai-agent' as Page, username: undefined },
                    { label: 'Invite & Earn', icon: UserPlus, page: 'invite' as Page, username: undefined },
                    { label: 'Settings', icon: Settings, page: 'settings' as Page, username: undefined },
                    ...(user?.role === 'admin' ? [{ label: 'Admin Dashboard', icon: LayoutDashboard, page: 'admin' as Page, username: undefined }] : []),
                  ].map(({ label, icon: Icon, page, username }) => (
                    <button
                      key={page}
                      onClick={() => { onNavigate(page, username); setProfileOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${page === 'admin' ? 'text-[#6366F1] font-semibold' : 'text-[#0F172A]'}`}
                    >
                      <Icon size={15} className={page === 'admin' ? 'text-[#6366F1]' : 'text-[#64748B]'} />
                      {label}
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { onLogout(); setProfileOpen(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Log out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2.5 rounded-xl text-[#64748B] hover:bg-gray-50"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out nav */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-72 bg-white shadow-2xl flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
              <Logo size="sm" />
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-gray-50">
                <X size={20} className="text-[#64748B]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <div className="px-4 py-3 mb-2">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">{displayName}</p>
                    <p className="text-xs text-[#64748B]">dimely.com/{displayUsername}</p>
                  </div>
                </div>
              </div>

              {NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const active = currentPage === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => { onNavigate(item.id as Page); setMobileOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                      active ? 'text-[#6366F1] bg-[#E0E7FF]' : 'text-[#0F172A] hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                )
              })}

              <div className="border-t border-gray-100 my-2" />

              {[
                { label: 'My Dimely', icon: User, page: 'profile' as Page, username: displayUsername },
                { label: 'My AI Agent', icon: Bot, page: 'ai-agent' as Page, username: undefined },
                { label: 'Invite & Earn', icon: UserPlus, page: 'invite' as Page, username: undefined },
                { label: 'Notifications', icon: Bell, page: 'notifications' as Page, username: undefined },
                { label: 'Settings', icon: Settings, page: 'settings' as Page, username: undefined },
              ].map(({ label, icon: Icon, page, username }) => (
                <button
                  key={page}
                  onClick={() => { onNavigate(page, username); setMobileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#0F172A] hover:bg-gray-50 transition-colors"
                >
                  <Icon size={18} className="text-[#64748B]" />
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button
                onClick={() => { onLogout(); setMobileOpen(false) }}
                className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut size={16} />
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {[...NAV_ITEMS, { id: 'notifications', label: 'Alerts', icon: Bell }].map((item) => {
            const Icon = item.icon
            const active = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as Page)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-[#6366F1]' : 'text-[#64748B]'
                }`}
              >
                <div className="relative">
                  <Icon size={20} />
                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#6366F1] rounded-full" />
                  )}
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
