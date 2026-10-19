// ─── API Client ─────────────────────────────────────────────────────────────
// All communication with the Dimely backend goes through this module.
// Never call fetch() directly in components.

// In production (Vercel), VITE_API_URL points to the Railway API server.
// In dev, it is unset and requests go through the Vite proxy at /api.
const API_URL = (import.meta.env.VITE_API_URL as string | undefined)
  ?? (typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? 'https://dimely-production.up.railway.app' : '')
const BASE = API_URL.replace(/\/$/, '') + '/api'

function getToken(): string | null {
  return localStorage.getItem('dimely_token')
}

export function setToken(token: string): void {
  localStorage.setItem('dimely_token', token)
}

export function clearToken(): void {
  localStorage.removeItem('dimely_token')
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { auth?: boolean; idempotencyKey?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (options.auth !== false) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  if (options.idempotencyKey) {
    headers['Idempotency-Key'] = options.idempotencyKey
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({ error: 'Invalid response from server' })) as Record<string, unknown>

  if (!res.ok) {
    const msg = typeof data['error'] === 'string' ? data['error'] : 'Something went wrong. Please try again.'
    throw new ApiError(msg, res.status, data)
  }

  return data as T
}

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  email: string
  name: string
  username: string
  role: string
}

export interface SignupPayload {
  email: string
  password: string
  name: string
  username: string
  inviteCode?: string
  category?: string
  pricePerMin?: number
  videoEnabled?: boolean
  voiceEnabled?: boolean
  headline?: string
}

export const auth = {
  signup: (payload: SignupPayload) =>
    request<{ token: string; user: AuthUser }>('POST', '/auth/signup', payload, { auth: false }),

  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>('POST', '/auth/login', { email, password }, { auth: false }),

  logout: () => request<{ ok: boolean }>('POST', '/auth/logout'),

  me: () => request<{ user: AuthUser; profile: Profile | null; referralCode: string | null; referralSlug: string | null }>('GET', '/auth/me'),
}

// ─── Profiles ────────────────────────────────────────────────────────────────

/** Base profile columns returned from the DB. */
export interface Profile {
  id: string
  user_id: string
  username: string
  name: string
  headline: string
  bio: string
  location: string
  timezone: string
  category: string
  tags: string[]
  price_per_min: number
  min_duration: number
  max_duration: number
  voice_available: boolean | number
  video_available: boolean | number
  avatar_color: string
  avatar_initials: string
  photo_url?: string | null
  social_instagram?: string | null
  social_twitter?: string | null
  social_linkedin?: string | null
  social_tiktok?: string | null
  social_youtube?: string | null
  verified: boolean | number
  published: boolean | number
  booking_count: number
  socialLinks?: {
    instagram?: string | null
    twitter?: string | null
    linkedin?: string | null
    tiktok?: string | null
    youtube?: string | null
  }
  /** Computed by the backend — true when there is a free slot today */
  available_today?: boolean
  /** Computed by the backend — human-readable label e.g. "Today, 3:00 PM" */
  next_available?: string
}

export const profiles = {
  list: (params?: {
    q?: string
    category?: string
    video?: boolean
    maxPrice?: number
    availableToday?: boolean
    limit?: number
    offset?: number
    exclude?: string
  }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.category && params.category !== 'All') qs.set('category', params.category)
    if (params?.video) qs.set('video', 'true')
    if (params?.maxPrice) qs.set('maxPrice', String(params.maxPrice))
    if (params?.availableToday) qs.set('availableToday', 'true')
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.offset) qs.set('offset', String(params.offset))
    if (params?.exclude) qs.set('exclude', params.exclude)
    const qStr = qs.toString()
    return request<{ profiles: Profile[]; total: number }>('GET', `/profiles${qStr ? `?${qStr}` : ''}`)
  },

  get: async (username: string) => {
    const res = await request<{ profile: Profile } | Profile>('GET', `/profiles/${username}`, undefined, { auth: false })
    return ('profile' in res ? res.profile : res)
  },

  availability: (username: string, date: string) =>
    request<{ slots: string[]; timezone: string; blocked?: boolean }>('GET', `/profiles/${username}/availability?date=${date}`),

  updateMe: (updates: Partial<Profile>) =>
    request<Profile>('PATCH', '/profiles/me', updates),

  update: (username: string, updates: Partial<Profile>) =>
    request<{ profile: Profile }>('PATCH', `/profiles/${username}`, updates),
}

export const profilesApi = profiles

// ─── Bookings ────────────────────────────────────────────────────────────────
export interface BookingPayload {
  profileUsername: string
  date: string
  startTime: string
  duration: number
  callType: 'voice' | 'video'
  topic: string
  guestName: string
  guestEmail: string
  guestTimezone?: string
  idempotencyKey?: string
}

export interface Booking {
  id: string
  guest_user_id: string
  host_user_id: string
  host_profile_id: string
  date: string
  start_time: string
  end_time: string
  duration: number
  call_type: string
  topic: string
  guest_name?: string
  guest_email?: string
  host_name?: string
  status: string
  gross_amount: number
  platform_fee: number
  host_earnings: number
  role?: 'host' | 'guest'
  cancelled_at?: string
  completed_at?: string
}

export const bookings = {
  create: (payload: BookingPayload) =>
    request<{ bookingId: string; gross: number; platformFee: number; status: string }>('POST', '/bookings', payload),

  confirmPayment: (bookingId: string, txHash?: string) =>
    request<{ bookingId: string; status: string }>('POST', `/bookings/${bookingId}/confirm-payment`, { txHash }),

  list: (role?: 'host' | 'guest') =>
    request<{ bookings: Booking[] }>('GET', `/bookings${role ? `?role=${role}` : ''}`),

  get: (id: string) =>
    request<Booking>('GET', `/bookings/${id}`),

  cancel: (id: string, reason?: string) =>
    request<{ bookingId: string; status: string; refundAmount: number }>('POST', `/bookings/${id}/cancel`, { reason }),

  complete: (id: string) =>
    request<{ bookingId: string; status: string; hostEarnings: number }>('POST', `/bookings/${id}/complete`),

  dispute: (id: string, reason: string, details?: string) =>
    request<{ bookingId: string; status: string }>('POST', `/bookings/${id}/dispute`, { reason, details }),
}

// ─── Earnings ────────────────────────────────────────────────────────────────
export interface EarningsSummary {
  available: number
  held: number
  totalEarned: number
  thisMonth: number
  referralEarnings: number
  totalCalls: number
  minutesBooked: number
  last7Days: number[]
  last7Labels: string[]
}

export interface Transaction {
  id: string
  guest_name?: string
  guestName?: string
  guestInitials?: string
  guestColor?: string
  date: string
  duration: number
  host_earnings?: number
  netEarnings?: number
  status: 'released' | 'completed' | 'pending' | 'disputed'
}

export const earnings = {
  summary: () => request<EarningsSummary>('GET', '/earnings/summary'),
  transactions: () => request<{ transactions: Transaction[] }>('GET', '/earnings/transactions'),
  withdraw: (amount: number, destinationAddress: string, idempotencyKey: string) =>
    request<{ withdrawalId: string; status: string; amount: number }>('POST', '/earnings/withdraw', {
      amount, destinationAddress, idempotencyKey,
    }),
}

// ─── Notifications ───────────────────────────────────────────────────────────
export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  timestamp?: string
  created_at?: string
}

export const notifications = {
  list: () => request<{ notifications: AppNotification[]; unreadCount: number }>('GET', '/notifications'),
  markRead: (id: string) => request<{ ok: boolean }>('PATCH', `/notifications/${id}/read`),
  markAllRead: () => request<{ ok: boolean }>('POST', '/notifications/read-all'),
}

// ─── Referrals ───────────────────────────────────────────────────────────────
export interface ReferralEntry {
  id?: string
  referred_name?: string
  name?: string
  created_at?: string
  joined?: string
  booking_count?: number
  bookings?: number
  total_commission?: number
  commission?: number
  status?: string
}

export interface ReferralDashboard {
  code: string | null
  linkSlug: string | null
  referrals: ReferralEntry[]
  totalEarned: number
  activeReferrals: number
}

export const referrals = {
  dashboard: () => request<ReferralDashboard>('GET', '/referrals/dashboard'),
  validate: (code: string) =>
    request<{ valid: boolean; type?: string; referrerName?: string }>('GET', `/referrals/validate/${code}`, undefined, { auth: false }),
}

// ─── AI Agent ────────────────────────────────────────────────────────────────
export interface AgentSettings {
  is_enabled: number
  auto_confirm: number
  respond_inquiries: number
  decline_conflicts: number
  allow_rescheduling: number
  allow_vip_requests: number
  [key: string]: number
}

export interface KnowledgeItem {
  id: string
  label: string
  content: string
  is_active: boolean
}

export interface AgentActivityItem {
  id: string
  type: string
  description: string
  created_at: string
}

export const aiAgent = {
  get: () => request<{ agent: AgentSettings; knowledge: KnowledgeItem[]; activity: AgentActivityItem[] }>('GET', '/ai-agent'),
  update: (data: Record<string, unknown>) => request<{ ok: boolean }>('PATCH', '/ai-agent', data),
  addKnowledge: (label: string, content: string) =>
    request<{ id: string; label: string; content: string }>('POST', '/ai-agent/knowledge', { label, content }),
  updateKnowledge: (id: string, content: string) =>
    request<{ ok: boolean }>('PATCH', `/ai-agent/knowledge/${id}`, { content }),
  deleteKnowledge: (id: string) =>
    request<{ ok: boolean }>('DELETE', `/ai-agent/knowledge/${id}`),
}

// ─── Availability ────────────────────────────────────────────────────────────
export interface AvailabilityWindow {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
}

export interface AvailabilityException {
  id: string
  date: string
  type: string
  note?: string
}

export const availability = {
  get: () => request<{ windows: AvailabilityWindow[]; exceptions: AvailabilityException[] }>('GET', '/availability'),
  setWindows: (windows: AvailabilityWindow[]) => request<{ ok: boolean }>('PUT', '/availability/windows', { windows }),
  addException: (date: string, type: string, note?: string) =>
    request<{ id: string }>('POST', '/availability/exceptions', { date, type, note }),
  deleteException: (id: string) =>
    request<{ ok: boolean }>('DELETE', `/availability/exceptions/${id}`),
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export interface AdminStats {
  users: { total: number; newThisMonth: number; hosts: number }
  marketplace: { totalProfiles: number; publishedProfiles: number; totalBookings: number; completedBookings: number; cancelledBookings: number; disputedBookings: number; inEscrowCount: number }
  financial: { grossVolume: number; platformRevenue: number; hostEarnings: number; heldEscrow: number; totalRefunds: number; withdrawalsTotal: number; withdrawalsCount: number }
  growth: { totalReferrals: number; activeReferrals: number; referralCommissions: number }
  ai: { activeAgents: number; activityThisMonth: number }
}

export interface AdminUser {
  id: string; email: string; name: string; username: string; role: string; created_at: string
  headline?: string; published?: number; booking_count?: number; verified?: number
  available?: number; held?: number; total_earned?: number
}

export interface AdminBooking {
  id: string; date: string; start_time: string; duration: number; call_type: string
  gross_amount: number; platform_fee: number; host_earnings: number
  guest_name_resolved: string; host_name_resolved: string
  status: string; escrow_status?: string; payment_status?: string; tx_hash?: string
}

export interface AdminDispute {
  id: string; booking_id: string; reason: string; details?: string; status: string; created_at: string
  guest_name: string; host_name: string; gross_amount: number; booking_status: string
}

export interface AdminPayment {
  id: string; booking_id: string; payer_name: string; host_name: string
  gross_amount: number; platform_fee: number; host_earnings: number
  status: string; escrow_status?: string; tx_hash?: string; created_at: string
}

export const admin = {
  stats: () => request<AdminStats>('GET', '/admin/stats'),
  users: (q?: string) => request<{ users: AdminUser[]; total: number }>('GET', `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getUser: (id: string) => request<{ user: AdminUser; bookingCount: number; recentTransactions: unknown[]; disputes: unknown[] }>('GET', `/admin/users/${id}`),
  suspendUser: (id: string, reason?: string) => request<{ ok: boolean }>('POST', `/admin/users/${id}/suspend`, { reason }),
  restoreUser: (id: string) => request<{ ok: boolean }>('POST', `/admin/users/${id}/restore`),
  verifyUser: (id: string) => request<{ ok: boolean }>('POST', `/admin/users/${id}/verify`),
  bookings: (status?: string) => request<{ bookings: AdminBooking[] }>('GET', `/admin/bookings${status ? `?status=${status}` : ''}`),
  payments: (status?: string) => request<{ payments: AdminPayment[] }>('GET', `/admin/payments${status ? `?status=${status}` : ''}`),
  disputes: (status?: string) => request<{ disputes: AdminDispute[] }>('GET', `/admin/disputes${status ? `?status=${status}` : ''}`),
  resolveDispute: (id: string, data: { resolution?: string; refundGuest?: boolean; releaseToHost?: boolean; note?: string }) =>
    request<{ ok: boolean }>('POST', `/admin/disputes/${id}/resolve`, data),
  config: () => request<{ config: Record<string, string> }>('GET', '/admin/config'),
  updateConfig: (updates: Record<string, string | number | boolean>) => request<{ ok: boolean }>('PATCH', '/admin/config', updates),
  withdrawals: (status?: string) => request<{ withdrawals: unknown[] }>('GET', `/admin/withdrawals${status ? `?status=${status}` : ''}`),
}

// ─── Calls ───────────────────────────────────────────────────────────────────
export interface CallInfo {
  id: string
  booking_id: string
  started_at: string | null
  ended_at: string | null
  status: string
}

export const calls = {
  get: (bookingId: string) =>
    request<{ call: CallInfo | null; booking: Booking; serverNow: number; msUntilStart: number; role: string }>('GET', `/calls/${bookingId}`),
  join: (bookingId: string) =>
    request<{ ok: boolean; role: string }>('POST', `/calls/${bookingId}/join`),
}
