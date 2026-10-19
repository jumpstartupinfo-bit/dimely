import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Nav } from './components/Nav'
import { LandingPage } from './pages/LandingPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { ProfilePage } from './pages/ProfilePage'
import { BookingFlow } from './pages/BookingFlow'
import { CalendarPage } from './pages/CalendarPage'
import { BookingsPage } from './pages/BookingsPage'
import { EarningsPage } from './pages/EarningsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { InviteEarnPage } from './pages/InviteEarnPage'
import { AIAgentPage } from './pages/AIAgentPage'
import { CallScreen } from './pages/CallScreen'
import { SettingsPage } from './pages/SettingsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { AdminDashboard } from './pages/AdminDashboard'

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

function AppInner() {
  const { isLoggedIn, loading, logout } = useAuth()

  // Read initial URL to restore page state
  const initialPath = window.location.pathname
  const initialPage: Page = initialPath === '/discover' ? 'discover' : initialPath.length > 1 ? 'profile' : 'landing'
  const initialUsername = initialPath.length > 1 && initialPath !== '/discover' ? initialPath.slice(1) : 'aisha-kim'

  const [page, setPage] = useState<Page>(initialPage)
  const [activeUsername, setActiveUsername] = useState<string>(initialUsername)
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>(undefined)
  const [returnTo, setReturnTo] = useState<{ page: Page; username?: string } | undefined>(undefined)

  function navigate(targetPage: Page, usernameOrBookingId?: string) {
    if (targetPage === 'profile' || targetPage === 'booking') {
      if (usernameOrBookingId) setActiveUsername(usernameOrBookingId)
    }
    if (targetPage === 'call') {
      if (usernameOrBookingId) setActiveBookingId(usernameOrBookingId)
    }
    // When navigating to onboarding mid-flow, record where to return
    if (targetPage === 'onboarding') {
      setReturnTo(page !== 'landing' && page !== 'onboarding'
        ? { page, username: activeUsername }
        : undefined)
    } else {
      setReturnTo(undefined)
    }
    setPage(targetPage)
    // Update URL so profile pages are shareable
    if (targetPage === 'profile' && usernameOrBookingId) {
      window.history.pushState({}, '', `/${usernameOrBookingId}`)
    } else if (targetPage === 'landing') {
      window.history.pushState({}, '', '/')
    } else if (targetPage === 'discover') {
      window.history.pushState({}, '', '/discover')
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleLogout() {
    void logout().then(() => setPage('landing'))
  }

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 rounded-full border-2 border-[#6366F1] border-t-transparent animate-spin" />
      </div>
    )
  }

  // Full-screen pages that handle their own top bar
  const fullScreen = page === 'landing' || page === 'booking' || page === 'call' || page === 'onboarding' || page === 'profile'

  return (
    <div className="min-h-dvh bg-[#F8FAFC]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Nav — shown on all pages (landing gets a different style internally) */}
      {!fullScreen && (
        <Nav
          currentPage={page}
          onNavigate={navigate}
          isLoggedIn={isLoggedIn}
          onLogout={handleLogout}
        />
      )}

      {page === 'landing' && (
        <Nav
          currentPage={page}
          onNavigate={navigate}
          isLoggedIn={isLoggedIn}
          onLogout={handleLogout}
        />
      )}

      {/* Page routing */}
      {page === 'landing' && <LandingPage onNavigate={navigate} />}

      {page === 'discover' && (
        <div className="pt-16">
          <DiscoverPage onNavigate={navigate} />
        </div>
      )}

      {page === 'profile' && (
        <ProfilePage username={activeUsername} onNavigate={navigate} />
      )}

      {page === 'booking' && (
        <BookingFlow username={activeUsername} onNavigate={navigate} />
      )}

      {page === 'calendar' && <CalendarPage onNavigate={navigate} />}

      {page === 'bookings' && <BookingsPage onNavigate={navigate} />}

      {page === 'earnings' && <EarningsPage onNavigate={navigate} />}

      {page === 'notifications' && <NotificationsPage onNavigate={navigate} />}

      {page === 'invite' && <InviteEarnPage onNavigate={navigate} />}

      {page === 'ai-agent' && <AIAgentPage onNavigate={navigate} />}

      {page === 'call' && <CallScreen bookingId={activeBookingId} onNavigate={navigate} />}

      {page === 'settings' && <SettingsPage onNavigate={navigate} onLogout={handleLogout} />}

      {page === 'onboarding' && <OnboardingPage onNavigate={navigate} returnTo={returnTo} />}

      {page === 'admin' && (
        <div className="pt-16">
          <AdminDashboard onNavigate={navigate} />
        </div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
