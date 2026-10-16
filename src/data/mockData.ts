export interface Booking {
  id: string
  personId: string
  personName: string
  personHeadline: string
  personInitials: string
  personColor: string
  date: string
  time: string
  duration: number
  callType: 'voice' | 'video'
  topic: string
  status: 'upcoming' | 'completed' | 'cancelled' | 'disputed'
  totalPaid: number
  platformFee: number
  hostEarnings: number
  role: 'guest' | 'host'
  joinUrl?: string
}

export interface Notification {
  id: string
  type:
    | 'new_booking'
    | 'booking_confirmed'
    | 'booking_cancelled'
    | 'reminder'
    | 'starting_soon'
    | 'call_completed'
    | 'payment_released'
    | 'refund'
    | 'referral_signup'
    | 'referral_earnings'
    | 'ai_activity'
  title: string
  body: string
  timestamp: string
  read: boolean
  avatar?: string
  avatarInitials?: string
  avatarColor?: string
}

export interface EarningsEntry {
  id: string
  date: string
  guestName: string
  guestInitials: string
  guestColor: string
  duration: number
  grossAmount: number
  platformFee: number
  referralCommission: number
  netEarnings: number
  status: 'pending' | 'released' | 'disputed'
}

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'b1',
    personId: '2',
    personName: 'Marcus Chen',
    personHeadline: 'Founder & Investor',
    personInitials: 'MC',
    personColor: '#0F172A',
    date: 'Oct 10, 2026',
    time: '10:00 AM',
    duration: 30,
    callType: 'video',
    topic: 'Fundraising strategy for my seed round',
    status: 'upcoming',
    totalPaid: 240,
    platformFee: 48,
    hostEarnings: 192,
    role: 'guest',
    joinUrl: '#',
  },
  {
    id: 'b2',
    personId: '7',
    personName: 'Priya Sharma',
    personHeadline: 'Finance & Investment Coach',
    personInitials: 'PS',
    personColor: '#059669',
    date: 'Oct 9, 2026',
    time: '6:00 PM',
    duration: 45,
    callType: 'video',
    topic: 'Personal investment portfolio review',
    status: 'upcoming',
    totalPaid: 405,
    platformFee: 81,
    hostEarnings: 324,
    role: 'guest',
    joinUrl: '#',
  },
  {
    id: 'b3',
    personId: '1',
    personName: 'Aisha Kim',
    personHeadline: 'Creator & Musician',
    personInitials: 'AK',
    personColor: '#6366F1',
    date: 'Oct 5, 2026',
    time: '3:00 PM',
    duration: 30,
    callType: 'video',
    topic: 'Creative collaboration and content strategy',
    status: 'completed',
    totalPaid: 120,
    platformFee: 24,
    hostEarnings: 96,
    role: 'guest',
  },
  {
    id: 'b4',
    personId: 'guest-anon',
    personName: 'Jordan Lee',
    personHeadline: 'Product Designer',
    personInitials: 'JL',
    personColor: '#7C3AED',
    date: 'Oct 8, 2026',
    time: '2:00 PM',
    duration: 30,
    callType: 'video',
    topic: 'Career pivot advice',
    status: 'upcoming',
    totalPaid: 180,
    platformFee: 36,
    hostEarnings: 144,
    role: 'host',
    joinUrl: '#',
  },
  {
    id: 'b5',
    personId: 'guest-anon-2',
    personName: 'Sam Rivera',
    personHeadline: 'Founder',
    personInitials: 'SR',
    personColor: '#0891B2',
    date: 'Oct 6, 2026',
    time: '11:00 AM',
    duration: 60,
    callType: 'voice',
    topic: 'Startup strategy session',
    status: 'completed',
    totalPaid: 360,
    platformFee: 72,
    hostEarnings: 288,
    role: 'host',
  },
]

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'starting_soon',
    title: 'Call starting in 15 minutes',
    body: 'Your call with Marcus Chen starts at 10:00 AM. Make sure your camera and mic are ready.',
    timestamp: '2026-10-10T09:45:00Z',
    read: false,
    avatarInitials: 'MC',
    avatarColor: '#0F172A',
  },
  {
    id: 'n2',
    type: 'new_booking',
    title: 'New booking from Jordan Lee',
    body: 'Jordan booked a 30-min video call on Oct 8 at 2:00 PM. Topic: Career pivot advice.',
    timestamp: '2026-10-07T14:23:00Z',
    read: false,
    avatarInitials: 'JL',
    avatarColor: '#7C3AED',
  },
  {
    id: 'n3',
    type: 'payment_released',
    title: 'Payment released — $288',
    body: 'Your earnings from the call with Sam Rivera have been released to your wallet.',
    timestamp: '2026-10-06T13:00:00Z',
    read: true,
    avatarInitials: 'SR',
    avatarColor: '#0891B2',
  },
  {
    id: 'n4',
    type: 'referral_signup',
    title: 'Your referral joined Dimely',
    body: 'Alex just created their Dimely page using your invite link. You\'ll earn 20% of platform revenue from their bookings for 12 months.',
    timestamp: '2026-10-05T10:11:00Z',
    read: true,
  },
  {
    id: 'n5',
    type: 'referral_earnings',
    title: 'Referral commission — $12.40',
    body: 'You earned a referral commission from a booking made by one of your referrals.',
    timestamp: '2026-10-04T18:45:00Z',
    read: true,
  },
  {
    id: 'n6',
    type: 'call_completed',
    title: 'Call completed',
    body: 'Your call with Aisha Kim is complete. We hope it was worth every minute.',
    timestamp: '2026-10-05T16:05:00Z',
    read: true,
    avatarInitials: 'AK',
    avatarColor: '#6366F1',
  },
  {
    id: 'n7',
    type: 'ai_activity',
    title: 'Your AI agent handled a booking',
    body: 'Your AI agent responded to an inquiry and confirmed a booking for Oct 12 at 9:00 AM.',
    timestamp: '2026-10-08T08:00:00Z',
    read: false,
  },
]

export const MOCK_EARNINGS: EarningsEntry[] = [
  {
    id: 'e1',
    date: 'Oct 6, 2026',
    guestName: 'Sam Rivera',
    guestInitials: 'SR',
    guestColor: '#0891B2',
    duration: 60,
    grossAmount: 360,
    platformFee: 72,
    referralCommission: 0,
    netEarnings: 288,
    status: 'released',
  },
  {
    id: 'e2',
    date: 'Oct 5, 2026',
    guestName: 'Mia Johnson',
    guestInitials: 'MJ',
    guestColor: '#7C3AED',
    duration: 30,
    grossAmount: 180,
    platformFee: 36,
    referralCommission: 0,
    netEarnings: 144,
    status: 'released',
  },
  {
    id: 'e3',
    date: 'Oct 3, 2026',
    guestName: 'Kai Nakamura',
    guestInitials: 'KN',
    guestColor: '#D97706',
    duration: 45,
    grossAmount: 270,
    platformFee: 54,
    referralCommission: 0,
    netEarnings: 216,
    status: 'released',
  },
  {
    id: 'e4',
    date: 'Oct 8, 2026',
    guestName: 'Jordan Lee',
    guestInitials: 'JL',
    guestColor: '#7C3AED',
    duration: 30,
    grossAmount: 180,
    platformFee: 36,
    referralCommission: 0,
    netEarnings: 144,
    status: 'pending',
  },
]

export const ADMIN_CONFIG = {
  platformFeePercent: 20,
  referralCommissionPercent: 20,
  referralDurationMonths: 12,
  inviteOnly: true,
}
