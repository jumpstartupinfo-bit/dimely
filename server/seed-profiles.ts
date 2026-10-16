/**
 * Seeds the 12 demo profiles from data/people.ts into the real SQLite DB.
 * Safe to call on every startup — uses INSERT OR IGNORE so it never overwrites
 * an existing row and never duplicates. A matching demo user is created for
 * each profile so bookings can be made against them.
 */
import db from './db'

interface DemoProfile {
  username: string
  name: string
  headline: string
  bio: string
  location: string
  category: string
  tags: string[]
  pricePerMin: number
  avatarColor: string
  avatarInitials: string
  voiceAvailable: boolean
  videoAvailable: boolean
  bookingCount: number
  verified: boolean
  socialLinks: {
    instagram?: string
    twitter?: string
    linkedin?: string
    tiktok?: string
    youtube?: string
  }
  // Availability windows: day 0=Sun..6=Sat, times in HH:MM
  availability: Array<{ day: number; start: string; end: string }>
}

const DEMOS: DemoProfile[] = [
  {
    username: 'aisha-kim',
    name: 'Aisha Kim',
    headline: 'Creator & Musician',
    bio: 'Multi-platinum artist and content creator. I talk about music production, creative entrepreneurship, and building a global audience from Africa. 3.2M followers across platforms.',
    location: 'Nairobi, Kenya',
    category: 'Creators',
    tags: ['Music', 'Creativity', 'Entrepreneurship', 'Content'],
    pricePerMin: 4,
    avatarColor: '#6366F1',
    avatarInitials: 'AK',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 128,
    verified: true,
    socialLinks: { instagram: 'aishakim', tiktok: 'aishakim', twitter: 'aishakim' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' }, // Mon
      { day: 2, start: '09:00', end: '17:00' }, // Tue
      { day: 3, start: '09:00', end: '17:00' }, // Wed
      { day: 4, start: '09:00', end: '17:00' }, // Thu
      { day: 5, start: '09:00', end: '15:00' }, // Fri
    ],
  },
  {
    username: 'marcus-chen',
    name: 'Marcus Chen',
    headline: 'Founder & Investor',
    bio: 'Three-time founder, two exits. Currently investing in early-stage B2B SaaS. Ask me anything about fundraising, product-market fit, or scaling from 0 to 1.',
    location: 'San Francisco, USA',
    category: 'Founders',
    tags: ['Startups', 'Fundraising', 'SaaS', 'Growth'],
    pricePerMin: 8,
    avatarColor: '#0F172A',
    avatarInitials: 'MC',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 342,
    verified: true,
    socialLinks: { linkedin: 'marcuschen', twitter: 'marcuschen' },
    availability: [
      { day: 1, start: '10:00', end: '16:00' },
      { day: 3, start: '10:00', end: '16:00' },
      { day: 5, start: '10:00', end: '14:00' },
    ],
  },
  {
    username: 'sofia-reyes',
    name: 'Sofia Reyes',
    headline: 'Athlete & Fitness Creator',
    bio: 'Olympic-level sprinter turned fitness creator with 2M followers. I help people build sustainable athletic performance habits and talk about elite sports culture.',
    location: 'Madrid, Spain',
    category: 'Athletes',
    tags: ['Fitness', 'Athletics', 'Wellness', 'Performance'],
    pricePerMin: 5,
    avatarColor: '#EC4899',
    avatarInitials: 'SR',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 87,
    verified: true,
    socialLinks: { instagram: 'sofiareyes', tiktok: 'sofiareyes', youtube: 'sofiareyes' },
    availability: [
      { day: 0, start: '09:00', end: '13:00' }, // Sun
      { day: 1, start: '09:00', end: '18:00' },
      { day: 2, start: '09:00', end: '18:00' },
      { day: 3, start: '09:00', end: '18:00' },
      { day: 4, start: '09:00', end: '18:00' },
      { day: 5, start: '09:00', end: '16:00' },
      { day: 6, start: '10:00', end: '14:00' }, // Sat
    ],
  },
  {
    username: 'james-okafor',
    name: 'James Okafor',
    headline: 'Marketing Strategist',
    bio: 'CMO at two unicorns. Expert in growth marketing, brand building, and scaling consumer products across emerging markets. Mentored 200+ founders.',
    location: 'Lagos, Nigeria',
    category: 'Consultants',
    tags: ['Marketing', 'Growth', 'Branding', 'Strategy'],
    pricePerMin: 6,
    avatarColor: '#F59E0B',
    avatarInitials: 'JO',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 215,
    verified: true,
    socialLinks: { linkedin: 'jamesokafor', twitter: 'jamesokafor' },
    availability: [
      { day: 1, start: '08:00', end: '18:00' },
      { day: 2, start: '08:00', end: '18:00' },
      { day: 3, start: '08:00', end: '18:00' },
      { day: 4, start: '08:00', end: '18:00' },
      { day: 5, start: '08:00', end: '16:00' },
    ],
  },
  {
    username: 'yuna-park',
    name: 'Yuna Park',
    headline: 'UX Designer & Educator',
    bio: 'Principal designer at a global tech company. I teach design thinking, product strategy, and how to build sustainable careers in design.',
    location: 'Seoul, South Korea',
    category: 'Coaches',
    tags: ['Design', 'UX', 'Career', 'Education'],
    pricePerMin: 3,
    avatarColor: '#8B5CF6',
    avatarInitials: 'YP',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 64,
    verified: true,
    socialLinks: { linkedin: 'yunapark', instagram: 'yunapark.design' },
    availability: [
      { day: 2, start: '10:00', end: '18:00' },
      { day: 4, start: '10:00', end: '18:00' },
      { day: 6, start: '10:00', end: '14:00' },
    ],
  },
  {
    username: 'devin-wells',
    name: 'Devin Wells',
    headline: 'Music Producer & DJ',
    bio: 'Grammy-nominated producer. Credits on 30+ charting records. I talk about the music industry, beat-making, sync licensing, and building a production career.',
    location: 'Atlanta, USA',
    category: 'Musicians',
    tags: ['Music', 'Production', 'Hip-Hop', 'Industry'],
    pricePerMin: 7,
    avatarColor: '#1D4ED8',
    avatarInitials: 'DW',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 156,
    verified: false,
    socialLinks: { instagram: 'devinwells', twitter: 'devinwells' },
    availability: [
      { day: 3, start: '14:00', end: '20:00' },
      { day: 5, start: '14:00', end: '20:00' },
      { day: 6, start: '12:00', end: '18:00' },
    ],
  },
  {
    username: 'priya-sharma',
    name: 'Priya Sharma',
    headline: 'Finance & Investment Coach',
    bio: 'Former Goldman Sachs VP. I help individuals and early-stage founders navigate personal finance, investing strategies, and building generational wealth.',
    location: 'Mumbai, India',
    category: 'Finance',
    tags: ['Finance', 'Investing', 'Wealth', 'Banking'],
    pricePerMin: 9,
    avatarColor: '#059669',
    avatarInitials: 'PS',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 189,
    verified: true,
    socialLinks: { linkedin: 'priyasharma', twitter: 'priyasharma' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
      { day: 4, start: '09:00', end: '17:00' },
    ],
  },
  {
    username: 'luca-romano',
    name: 'Luca Romano',
    headline: 'Tech Lead & Entrepreneur',
    bio: 'Engineering leader who has built teams of 100+ at fast-scaling startups. Passionate about engineering culture, system architecture, and technical hiring.',
    location: 'Milan, Italy',
    category: 'Technology',
    tags: ['Technology', 'Engineering', 'Leadership', 'Career'],
    pricePerMin: 7,
    avatarColor: '#0891B2',
    avatarInitials: 'LR',
    voiceAvailable: true,
    videoAvailable: false,
    bookingCount: 43,
    verified: true,
    socialLinks: { linkedin: 'lucaromano', twitter: 'lucaromano' },
    availability: [
      { day: 1, start: '18:00', end: '22:00' },
      { day: 3, start: '18:00', end: '22:00' },
      { day: 5, start: '16:00', end: '21:00' },
    ],
  },
  {
    username: 'camila-torres',
    name: 'Camila Torres',
    headline: 'Skincare Influencer & Esthetician',
    bio: 'Licensed esthetician and beauty content creator with 4M followers. I do private skincare consultations, brand strategy calls, and creator coaching.',
    location: 'São Paulo, Brazil',
    category: 'Influencers',
    tags: ['Skincare', 'Beauty', 'Wellness', 'Content'],
    pricePerMin: 4,
    avatarColor: '#DB2777',
    avatarInitials: 'CT',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 301,
    verified: true,
    socialLinks: { instagram: 'camilatorres', tiktok: 'camilatorres', youtube: 'camilatorres' },
    availability: [
      { day: 2, start: '13:00', end: '19:00' },
      { day: 4, start: '13:00', end: '19:00' },
      { day: 6, start: '10:00', end: '16:00' },
    ],
  },
  {
    username: 'rafe-hampton',
    name: 'Rafe Hampton',
    headline: 'Career & Interview Coach',
    bio: 'Former recruiter at FAANG companies. I help professionals nail interviews, negotiate offers, and accelerate their careers at top tech companies.',
    location: 'London, UK',
    category: 'Coaches',
    tags: ['Career', 'Interviews', 'Job Search', 'Negotiation'],
    pricePerMin: 5,
    avatarColor: '#7C3AED',
    avatarInitials: 'RH',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 97,
    verified: false,
    socialLinks: { linkedin: 'rafehampton', twitter: 'rafehampton' },
    availability: [
      { day: 1, start: '09:00', end: '12:00' },
      { day: 2, start: '09:00', end: '12:00' },
      { day: 3, start: '09:00', end: '12:00' },
      { day: 4, start: '09:00', end: '12:00' },
      { day: 5, start: '09:00', end: '12:00' },
      { day: 6, start: '10:00', end: '14:00' },
    ],
  },
  {
    username: 'naledi-dube',
    name: 'Naledi Dube',
    headline: 'Entrepreneur & Startup Coach',
    bio: 'Built 3 successful companies across fintech and consumer goods. I mentor early-stage founders on product, fundraising, and African market entry.',
    location: 'Johannesburg, South Africa',
    category: 'Founders',
    tags: ['Startups', 'Africa', 'Fintech', 'Mentorship'],
    pricePerMin: 6,
    avatarColor: '#D97706',
    avatarInitials: 'ND',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 72,
    verified: true,
    socialLinks: { linkedin: 'naledidube', twitter: 'naledidube' },
    availability: [
      { day: 1, start: '08:00', end: '14:00' },
      { day: 2, start: '08:00', end: '14:00' },
      { day: 3, start: '08:00', end: '14:00' },
    ],
  },
  {
    username: 'alex-cho',
    name: 'Alex Cho',
    headline: 'Legal Counsel & IP Strategist',
    bio: 'IP and startup attorney. I help founders and creators protect their work, navigate contracts, and build legally sound businesses from day one.',
    location: 'New York, USA',
    category: 'Legal',
    tags: ['Legal', 'IP', 'Contracts', 'Startups'],
    pricePerMin: 10,
    avatarColor: '#DC2626',
    avatarInitials: 'AC',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 58,
    verified: true,
    socialLinks: { linkedin: 'alexcho' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
      { day: 4, start: '09:00', end: '17:00' },
      { day: 5, start: '09:00', end: '13:00' },
    ],
  },
]

function crypto_rand_hex(n: number): string {
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function seedDemoProfiles(): void {
  for (const demo of DEMOS) {
    // 1. Create a placeholder user for this profile (password can never be used)
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(demo.username) as { id: string } | undefined
    let userId: string
    if (existingUser) {
      userId = existingUser.id
    } else {
      userId = `demo_${demo.username}`
      db.prepare(`
        INSERT OR IGNORE INTO users(id, email, password_hash, name, username, role, email_verified)
        VALUES (?, ?, ?, ?, ?, 'demo', 1)
      `).run(userId, `${demo.username}@demo.dimely.com`, '__no_login__', demo.name, demo.username)
    }

    // 2. Create/update profile
    const existingProfile = db.prepare('SELECT id FROM profiles WHERE username = ?').get(demo.username) as { id: string } | undefined
    let profileId: string
    if (existingProfile) {
      profileId = existingProfile.id
    } else {
      profileId = `profile_${demo.username}`
      db.prepare(`
        INSERT OR IGNORE INTO profiles(
          id, user_id, username, name, headline, bio, location,
          category, tags, price_per_min, min_duration, max_duration,
          voice_available, video_available, avatar_color, avatar_initials,
          social_instagram, social_twitter, social_linkedin, social_tiktok, social_youtube,
          verified, published, booking_count
        ) VALUES (?,?,?,?,?,?,?,?,?,?,15,60,?,?,?,?,?,?,?,?,?,?,1,?)
      `).run(
        profileId, userId, demo.username, demo.name, demo.headline, demo.bio, demo.location,
        demo.category, JSON.stringify(demo.tags), demo.pricePerMin,
        demo.voiceAvailable ? 1 : 0, demo.videoAvailable ? 1 : 0,
        demo.avatarColor, demo.avatarInitials,
        demo.socialLinks.instagram ?? null,
        demo.socialLinks.twitter ?? null,
        demo.socialLinks.linkedin ?? null,
        demo.socialLinks.tiktok ?? null,
        demo.socialLinks.youtube ?? null,
        demo.verified ? 1 : 0,
        demo.bookingCount,
      )
    }

    // 3. Seed availability windows (only if none exist yet)
    const existingAvail = db.prepare('SELECT id FROM availability WHERE profile_id = ?').get(profileId)
    if (!existingAvail) {
      for (const w of demo.availability) {
        db.prepare(`
          INSERT OR IGNORE INTO availability(id, profile_id, day_of_week, start_time, end_time)
          VALUES (?, ?, ?, ?, ?)
        `).run(`avail_${crypto_rand_hex(8)}`, profileId, w.day, w.start, w.end)
      }
    }
  }
}
