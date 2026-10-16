export interface Person {
  id: string
  username: string
  name: string
  verified: boolean
  headline: string
  location: string
  bio: string
  tags: string[]
  category: string
  pricePerMin: number
  avatarColor: string
  avatarInitials: string
  voiceAvailable: boolean
  videoAvailable: boolean
  bookingCount: number
  badge?: 'Popular' | 'Trending' | 'New' | 'Fast responder' | 'Available today'
  availableToday: boolean
  nextAvailable: string
  languages: string[]
  socialLinks: {
    instagram?: string
    twitter?: string
    linkedin?: string
    tiktok?: string
    youtube?: string
  }
}

export const PEOPLE: Person[] = [
  {
    id: '1',
    username: 'aisha-kim',
    name: 'Aisha Kim',
    verified: true,
    headline: 'Creator & Musician',
    location: 'Nairobi, Kenya',
    bio: 'Multi-platinum artist and content creator. I talk about music production, creative entrepreneurship, and building a global audience from Africa. 3.2M followers across platforms.',
    tags: ['Music', 'Creativity', 'Entrepreneurship', 'Content'],
    category: 'Creators',
    pricePerMin: 4,
    avatarColor: '#6366F1',
    avatarInitials: 'AK',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 128,
    badge: 'Popular',
    availableToday: true,
    nextAvailable: 'Today, 3:00 PM',
    languages: ['English', 'Swahili'],
    socialLinks: { instagram: 'aishakim', tiktok: 'aishakim', twitter: 'aishakim' },
  },
  {
    id: '2',
    username: 'marcus-chen',
    name: 'Marcus Chen',
    verified: true,
    headline: 'Founder & Investor',
    location: 'San Francisco, USA',
    bio: 'Three-time founder, two exits. Currently investing in early-stage B2B SaaS. Ask me anything about fundraising, product-market fit, or scaling from 0 to 1.',
    tags: ['Startups', 'Fundraising', 'SaaS', 'Growth'],
    category: 'Founders',
    pricePerMin: 8,
    avatarColor: '#0F172A',
    avatarInitials: 'MC',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 342,
    badge: 'Trending',
    availableToday: false,
    nextAvailable: 'Tomorrow, 10:00 AM',
    languages: ['English', 'Mandarin'],
    socialLinks: { linkedin: 'marcuschen', twitter: 'marcuschen' },
  },
  {
    id: '3',
    username: 'sofia-reyes',
    name: 'Sofia Reyes',
    verified: true,
    headline: 'Athlete & Fitness Creator',
    location: 'Madrid, Spain',
    bio: 'Olympic-level sprinter turned fitness creator with 2M followers. I help people build sustainable athletic performance habits and talk about elite sports culture.',
    tags: ['Fitness', 'Athletics', 'Wellness', 'Performance'],
    category: 'Athletes',
    pricePerMin: 5,
    avatarColor: '#EC4899',
    avatarInitials: 'SR',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 87,
    badge: 'Available today',
    availableToday: true,
    nextAvailable: 'Today, 5:30 PM',
    languages: ['English', 'Spanish'],
    socialLinks: { instagram: 'sofiareyes', tiktok: 'sofiareyes', youtube: 'sofiareyes' },
  },
  {
    id: '4',
    username: 'james-okafor',
    name: 'James Okafor',
    verified: true,
    headline: 'Marketing Strategist',
    location: 'Lagos, Nigeria',
    bio: 'CMO at two unicorns. Expert in growth marketing, brand building, and scaling consumer products across emerging markets. Mentored 200+ founders.',
    tags: ['Marketing', 'Growth', 'Branding', 'Strategy'],
    category: 'Consultants',
    pricePerMin: 6,
    avatarColor: '#F59E0B',
    avatarInitials: 'JO',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 215,
    badge: 'Fast responder',
    availableToday: true,
    nextAvailable: 'Today, 2:00 PM',
    languages: ['English', 'Yoruba'],
    socialLinks: { linkedin: 'jamesokafor', twitter: 'jamesokafor' },
  },
  {
    id: '5',
    username: 'yuna-park',
    name: 'Yuna Park',
    verified: true,
    headline: 'UX Designer & Educator',
    location: 'Seoul, South Korea',
    bio: 'Principal designer at a global tech company. I teach design thinking, product strategy, and how to build sustainable careers in design.',
    tags: ['Design', 'UX', 'Career', 'Education'],
    category: 'Coaches',
    pricePerMin: 3,
    avatarColor: '#8B5CF6',
    avatarInitials: 'YP',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 64,
    badge: 'New',
    availableToday: false,
    nextAvailable: 'Fri, Oct 9, 11:00 AM',
    languages: ['English', 'Korean'],
    socialLinks: { linkedin: 'yunapark', instagram: 'yunapark.design' },
  },
  {
    id: '6',
    username: 'devin-wells',
    name: 'Devin Wells',
    verified: false,
    headline: 'Music Producer & DJ',
    location: 'Atlanta, USA',
    bio: 'Grammy-nominated producer. Credits on 30+ charting records. I talk about the music industry, beat-making, sync licensing, and building a production career.',
    tags: ['Music', 'Production', 'Hip-Hop', 'Industry'],
    category: 'Musicians',
    pricePerMin: 7,
    avatarColor: '#1D4ED8',
    avatarInitials: 'DW',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 156,
    badge: 'Trending',
    availableToday: false,
    nextAvailable: 'Sat, Oct 10, 4:00 PM',
    languages: ['English'],
    socialLinks: { instagram: 'devinwells', twitter: 'devinwells' },
  },
  {
    id: '7',
    username: 'priya-sharma',
    name: 'Priya Sharma',
    verified: true,
    headline: 'Finance & Investment Coach',
    location: 'Mumbai, India',
    bio: 'Former Goldman Sachs VP. I help individuals and early-stage founders navigate personal finance, investing strategies, and building generational wealth.',
    tags: ['Finance', 'Investing', 'Wealth', 'Banking'],
    category: 'Finance',
    pricePerMin: 9,
    avatarColor: '#059669',
    avatarInitials: 'PS',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 189,
    badge: 'Popular',
    availableToday: true,
    nextAvailable: 'Today, 6:00 PM',
    languages: ['English', 'Hindi'],
    socialLinks: { linkedin: 'priyasharma', twitter: 'priyasharma' },
  },
  {
    id: '8',
    username: 'luca-romano',
    name: 'Luca Romano',
    verified: true,
    headline: 'Tech Lead & Entrepreneur',
    location: 'Milan, Italy',
    bio: 'Engineering leader who has built teams of 100+ at fast-scaling startups. Passionate about engineering culture, system architecture, and technical hiring.',
    tags: ['Technology', 'Engineering', 'Leadership', 'Career'],
    category: 'Technology',
    pricePerMin: 7,
    avatarColor: '#0891B2',
    avatarInitials: 'LR',
    voiceAvailable: true,
    videoAvailable: false,
    bookingCount: 43,
    badge: 'Fast responder',
    availableToday: true,
    nextAvailable: 'Today, 8:00 PM',
    languages: ['English', 'Italian'],
    socialLinks: { linkedin: 'lucaromano', twitter: 'lucaromano' },
  },
  {
    id: '9',
    username: 'camila-torres',
    name: 'Camila Torres',
    verified: true,
    headline: 'Skincare Influencer & Esthetician',
    location: 'São Paulo, Brazil',
    bio: 'Licensed esthetician and beauty content creator with 4M followers. I do private skincare consultations, brand strategy calls, and creator coaching.',
    tags: ['Skincare', 'Beauty', 'Wellness', 'Content'],
    category: 'Influencers',
    pricePerMin: 4,
    avatarColor: '#DB2777',
    avatarInitials: 'CT',
    voiceAvailable: false,
    videoAvailable: true,
    bookingCount: 301,
    badge: 'Popular',
    availableToday: false,
    nextAvailable: 'Tomorrow, 2:00 PM',
    languages: ['English', 'Portuguese'],
    socialLinks: { instagram: 'camilatorres', tiktok: 'camilatorres', youtube: 'camilatorres' },
  },
  {
    id: '10',
    username: 'rafe-hampton',
    name: 'Rafe Hampton',
    verified: false,
    headline: 'Career & Interview Coach',
    location: 'London, UK',
    bio: 'Former recruiter at FAANG companies. I help professionals nail interviews, negotiate offers, and accelerate their careers at top tech companies.',
    tags: ['Career', 'Interviews', 'Job Search', 'Negotiation'],
    category: 'Coaches',
    pricePerMin: 5,
    avatarColor: '#7C3AED',
    avatarInitials: 'RH',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 97,
    badge: 'Fast responder',
    availableToday: true,
    nextAvailable: 'Today, 4:00 PM',
    languages: ['English'],
    socialLinks: { linkedin: 'rafehampton', twitter: 'rafehampton' },
  },
  {
    id: '11',
    username: 'naledi-dube',
    name: 'Naledi Dube',
    verified: true,
    headline: 'Entrepreneur & Startup Coach',
    location: 'Johannesburg, South Africa',
    bio: 'Built 3 successful companies across fintech and consumer goods. I mentor early-stage founders on product, fundraising, and African market entry.',
    tags: ['Startups', 'Africa', 'Fintech', 'Mentorship'],
    category: 'Founders',
    pricePerMin: 6,
    avatarColor: '#D97706',
    avatarInitials: 'ND',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 72,
    badge: 'Trending',
    availableToday: false,
    nextAvailable: 'Mon, Oct 12, 9:00 AM',
    languages: ['English', 'Zulu'],
    socialLinks: { linkedin: 'naledidube', twitter: 'naledidube' },
  },
  {
    id: '12',
    username: 'alex-cho',
    name: 'Alex Cho',
    verified: true,
    headline: 'Legal Counsel & IP Strategist',
    location: 'New York, USA',
    bio: 'IP and startup attorney. I help founders and creators protect their work, navigate contracts, and build legally sound businesses from day one.',
    tags: ['Legal', 'IP', 'Contracts', 'Startups'],
    category: 'Legal',
    pricePerMin: 10,
    avatarColor: '#DC2626',
    avatarInitials: 'AC',
    voiceAvailable: true,
    videoAvailable: true,
    bookingCount: 58,
    badge: 'Popular',
    availableToday: true,
    nextAvailable: 'Today, 1:00 PM',
    languages: ['English', 'Korean'],
    socialLinks: { linkedin: 'alexcho' },
  },
]

export const CATEGORIES = [
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

export function getPerson(username: string): Person | undefined {
  return PEOPLE.find((p) => p.username === username)
}

export function searchPeople(query: string, category?: string): Person[] {
  const q = query.toLowerCase().trim()
  return PEOPLE.filter((p) => {
    const matchesCategory =
      !category || category === 'All'
        ? true
        : p.category.toLowerCase() === category.toLowerCase() ||
          p.tags.some((t) => t.toLowerCase().includes(category.toLowerCase()))
    if (!matchesCategory) return false
    if (!q) return true
    return (
      p.name.toLowerCase().includes(q) ||
      p.headline.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.bio.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q)
    )
  })
}
