/**
 * Seeds the 12 demo profiles into the Postgres DB.
 * Safe to call on every startup — uses ON CONFLICT DO NOTHING so it never
 * overwrites existing rows and never duplicates.
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
  photoUrl: string
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
  availability: Array<{ day: number; start: string; end: string }>
}

const DEMOS: DemoProfile[] = [
  {
    username: 'marcus-chen',
    name: 'Marcus Chen',
    headline: 'Founder & Investor',
    bio: 'Serial entrepreneur with 3 exits. I talk startup strategy, fundraising, and scaling from 0 to 1. Partner at a seed fund focused on African and Southeast Asian founders.',
    location: 'San Francisco, USA',
    category: 'Business',
    tags: ['Startups', 'Fundraising', 'SaaS', 'VC'],
    pricePerMin: 8,
    avatarColor: '#0F172A',
    avatarInitials: 'MC',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 342,
    verified: true,
    socialLinks: { twitter: 'marcuschen', linkedin: 'marcuschen' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
      { day: 4, start: '09:00', end: '17:00' },
      { day: 5, start: '09:00', end: '15:00' },
    ],
  },
  {
    username: 'camila-torres',
    name: 'Camila Torres',
    headline: 'Skincare Influencer & Esthetician',
    bio: 'Licensed esthetician and beauty creator with 2.1M followers. I help people build personalised skincare routines and navigate the overwhelming world of beauty products.',
    location: 'São Paulo, Brazil',
    category: 'Health & Wellness',
    tags: ['Skincare', 'Beauty', 'Wellness'],
    pricePerMin: 4,
    avatarColor: '#DB2777',
    avatarInitials: 'CT',
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 201,
    verified: true,
    socialLinks: { instagram: 'camilatorres', tiktok: 'camilatorres' },
    availability: [
      { day: 1, start: '10:00', end: '18:00' },
      { day: 2, start: '10:00', end: '18:00' },
      { day: 3, start: '10:00', end: '18:00' },
      { day: 6, start: '10:00', end: '14:00' },
    ],
  },
  {
    username: 'james-okonkwo',
    name: 'James Okonkwo',
    headline: 'Marketing Strategist',
    bio: 'Growth marketer who has scaled 4 African startups to 7-figure revenues. Expert in performance marketing, brand building, and GTM strategy for emerging markets.',
    location: 'Lagos, Nigeria',
    category: 'Marketing',
    tags: ['Marketing', 'Growth', 'Branding', 'GTM'],
    pricePerMin: 5,
    avatarColor: '#F59E0B',
    avatarInitials: 'JO',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 215,
    verified: true,
    socialLinks: { linkedin: 'jamesokonkwo', twitter: 'jamesokonkwo' },
    availability: [
      { day: 1, start: '08:00', end: '16:00' },
      { day: 2, start: '08:00', end: '16:00' },
      { day: 3, start: '08:00', end: '16:00' },
      { day: 4, start: '08:00', end: '16:00' },
      { day: 5, start: '08:00', end: '12:00' },
    ],
  },
  {
    username: 'priya-sharma',
    name: 'Priya Sharma',
    headline: 'Finance & Wealth Advisor',
    bio: 'CFA charterholder and personal finance educator. I simplify investing, tax strategy, and wealth building for professionals in their 20s and 30s.',
    location: 'Mumbai, India',
    category: 'Finance',
    tags: ['Finance', 'Investing', 'Wealth', 'Tax'],
    pricePerMin: 6,
    avatarColor: '#059669',
    avatarInitials: 'PS',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 178,
    verified: true,
    socialLinks: { linkedin: 'priyasharma', instagram: 'priyasharma' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 4, start: '09:00', end: '17:00' },
      { day: 5, start: '09:00', end: '15:00' },
    ],
  },
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
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 128,
    verified: true,
    socialLinks: { instagram: 'aishakim', tiktok: 'aishakim', twitter: 'aishakim' },
    availability: [
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
      { day: 4, start: '09:00', end: '17:00' },
      { day: 5, start: '09:00', end: '15:00' },
    ],
  },
  {
    username: 'naledi-dube',
    name: 'Naledi Dube',
    headline: 'Entrepreneur & Startup Coach',
    bio: 'Founded and sold two fintech companies. Now coaching underrepresented founders across Africa and the diaspora on fundraising, product-market fit, and building resilient teams.',
    location: 'Johannesburg, South Africa',
    category: 'Business',
    tags: ['Startups', 'Africa', 'Fintech', 'Coaching'],
    pricePerMin: 6,
    avatarColor: '#D97706',
    avatarInitials: 'ND',
    photoUrl: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 72,
    verified: true,
    socialLinks: { linkedin: 'naledidube', twitter: 'naledidube' },
    availability: [
      { day: 1, start: '08:00', end: '16:00' },
      { day: 2, start: '08:00', end: '16:00' },
      { day: 3, start: '08:00', end: '16:00' },
      { day: 4, start: '08:00', end: '16:00' },
    ],
  },
  {
    username: 'yuna-park',
    name: 'Yuna Park',
    headline: 'UX Designer & Educator',
    bio: 'Lead UX designer at a top-10 global app. I teach design thinking, portfolio building, and career transitions into product design — especially for self-taught designers.',
    location: 'Seoul, South Korea',
    category: 'Design',
    tags: ['Design', 'UX', 'Career', 'Portfolio'],
    pricePerMin: 3,
    avatarColor: '#7C3AED',
    avatarInitials: 'YP',
    photoUrl: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 64,
    verified: true,
    socialLinks: { instagram: 'yunapark', linkedin: 'yunapark' },
    availability: [
      { day: 2, start: '18:00', end: '22:00' },
      { day: 4, start: '18:00', end: '22:00' },
      { day: 6, start: '10:00', end: '16:00' },
      { day: 0, start: '12:00', end: '18:00' },
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
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
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
  {
    username: 'luca-romano',
    name: 'Luca Romano',
    headline: 'Tech Lead & Engineering Manager',
    bio: 'Ex-Google, now building and advising engineering teams at growth-stage startups. I help developers level up, navigate system design, and grow into leadership roles.',
    location: 'Milan, Italy',
    category: 'Technology',
    tags: ['Technology', 'Engineering', 'Leadership', 'Career'],
    pricePerMin: 7,
    avatarColor: '#0891B2',
    avatarInitials: 'LR',
    photoUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 43,
    verified: true,
    socialLinks: { linkedin: 'lucaromano', twitter: 'lucaromano' },
    availability: [
      { day: 1, start: '17:00', end: '21:00' },
      { day: 3, start: '17:00', end: '21:00' },
      { day: 5, start: '17:00', end: '21:00' },
    ],
  },
  {
    username: 'fatima-al-rashid',
    name: 'Fatima Al-Rashid',
    headline: 'Executive Career Coach',
    bio: 'Former McKinsey consultant turned career coach. I help ambitious professionals land top-tier jobs, negotiate offers, and build their personal brand for leadership roles.',
    location: 'Dubai, UAE',
    category: 'Career',
    tags: ['Career', 'Leadership', 'Consulting', 'Executive'],
    pricePerMin: 9,
    avatarColor: '#6366F1',
    avatarInitials: 'FA',
    photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 97,
    verified: true,
    socialLinks: { linkedin: 'fatimaralrashid' },
    availability: [
      { day: 0, start: '10:00', end: '18:00' },
      { day: 1, start: '09:00', end: '17:00' },
      { day: 2, start: '09:00', end: '17:00' },
      { day: 3, start: '09:00', end: '17:00' },
    ],
  },
  {
    username: 'kwame-asante',
    name: 'Kwame Asante',
    headline: 'Blockchain & Web3 Developer',
    bio: 'Smart contract engineer and DeFi protocol architect. I help teams navigate Web3 development, tokenomics design, and blockchain infrastructure for real-world use cases.',
    location: 'Accra, Ghana',
    category: 'Technology',
    tags: ['Web3', 'Blockchain', 'DeFi', 'Smart Contracts'],
    pricePerMin: 8,
    avatarColor: '#059669',
    avatarInitials: 'KA',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 31,
    verified: true,
    socialLinks: { twitter: 'kwameasante', linkedin: 'kwameasante' },
    availability: [
      { day: 1, start: '18:00', end: '22:00' },
      { day: 2, start: '18:00', end: '22:00' },
      { day: 3, start: '18:00', end: '22:00' },
      { day: 6, start: '09:00', end: '17:00' },
    ],
  },
  {
    username: 'sofia-reyes',
    name: 'Sofia Reyes',
    headline: 'Mindfulness & Productivity Coach',
    bio: 'Certified mindfulness instructor and productivity coach. I help high-achievers and entrepreneurs manage stress, build sustainable habits, and perform at their best without burning out.',
    location: 'Mexico City, Mexico',
    category: 'Health & Wellness',
    tags: ['Mindfulness', 'Productivity', 'Wellness', 'Coaching'],
    pricePerMin: 3,
    avatarColor: '#EC4899',
    avatarInitials: 'SR',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 156,
    verified: true,
    socialLinks: { instagram: 'sofiareyes', youtube: 'sofiareyes' },
    availability: [
      { day: 1, start: '07:00', end: '12:00' },
      { day: 2, start: '07:00', end: '12:00' },
      { day: 3, start: '07:00', end: '12:00' },
      { day: 4, start: '07:00', end: '12:00' },
      { day: 5, start: '07:00', end: '12:00' },
    ],
  },
]

export async function seedDemoProfiles(): Promise<void> {
  for (const demo of DEMOS) {
    // 1. Create a placeholder user for this profile
    const existingUser = await db.prepare('SELECT id FROM users WHERE username = $1').get(demo.username) as { id: string } | undefined
    let userId: string
    if (existingUser) {
      userId = existingUser.id
    } else {
      userId = `demo_${demo.username}`
      await db.prepare(`
        INSERT INTO users(id, email, password_hash, name, username, role, email_verified)
        VALUES ($1, $2, $3, $4, $5, 'demo', true)
        ON CONFLICT (id) DO NOTHING
      `).run(userId, `${demo.username}@demo.dimely.com`, '__no_login__', demo.name, demo.username)
    }

    // 2. Create profile (skip if exists)
    const existingProfile = await db.prepare('SELECT id FROM profiles WHERE username = $1').get(demo.username) as { id: string } | undefined
    let profileId: string
    if (existingProfile) {
      profileId = existingProfile.id
    } else {
      profileId = `profile_${demo.username}`
      await db.prepare(`
        INSERT INTO profiles(
          id, user_id, username, name, headline, bio, location,
          category, tags, price_per_min, min_duration, max_duration,
          voice_available, video_available, avatar_color, avatar_initials, photo_url,
          social_instagram, social_twitter, social_linkedin, social_tiktok, social_youtube,
          verified, published, booking_count
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,15,60,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,true,$22)
        ON CONFLICT (id) DO NOTHING
      `).run(
        profileId, userId, demo.username, demo.name, demo.headline, demo.bio, demo.location,
        demo.category, JSON.stringify(demo.tags), demo.pricePerMin,
        demo.voiceAvailable, demo.videoAvailable,
        demo.avatarColor, demo.avatarInitials, demo.photoUrl,
        demo.socialLinks.instagram ?? null,
        demo.socialLinks.twitter ?? null,
        demo.socialLinks.linkedin ?? null,
        demo.socialLinks.tiktok ?? null,
        demo.socialLinks.youtube ?? null,
        demo.verified,
        demo.bookingCount,
      )
    }

    // 3. Seed availability windows (only if none exist yet)
    const existingAvail = await db.prepare('SELECT id FROM availability WHERE profile_id = $1').get(profileId)
    if (!existingAvail) {
      for (const w of demo.availability) {
        const id = `avail_${profileId}_${w.day}`
        await db.prepare(`
          INSERT INTO availability(id, profile_id, day_of_week, start_time, end_time)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (id) DO NOTHING
        `).run(id, profileId, w.day, w.start, w.end)
      }
    }
  }
  console.log('Demo profiles seeded.')
}
