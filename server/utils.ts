import crypto from 'crypto'

export function newId(): string {
  return crypto.randomUUID()
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 30)
}

export function generateReferralCode(username: string): string {
  const arr = new Uint8Array(3)
  crypto.getRandomValues(arr)
  const suffix = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  return `DIMELY-${username.toUpperCase().slice(0, 6)}-${suffix}`
}

export function generateReferralSlug(username: string): string {
  const arr = new Uint8Array(3)
  crypto.getRandomValues(arr)
  const suffix = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase()
  return `${username.toLowerCase()}-${suffix}`
}

// Calculate booking price breakdown server-side — never trust the client
export function calcBookingAmounts(
  pricePerMin: number,
  durationMin: number,
  platformFeePercent: number
): { gross: number; platformFee: number; hostEarnings: number } {
  const gross = Math.round(pricePerMin * durationMin * 100) / 100
  const platformFee = Math.round(gross * (platformFeePercent / 100) * 100) / 100
  const hostEarnings = Math.round((gross - platformFee) * 100) / 100
  return { gross, platformFee, hostEarnings }
}

// Calculate referral commission from eligible platform revenue
export function calcReferralCommission(
  platformRevenue: number,
  commissionPercent: number
): number {
  return Math.round(platformRevenue * (commissionPercent / 100) * 100) / 100
}

// Check if referral relationship is within duration
export function isReferralActive(expiresAt: string): boolean {
  return new Date(expiresAt) > new Date()
}

// Simple timezone-aware slot check: convert host local time to UTC
export function localTimeToUtc(date: string, time: string, timezone: string): Date {
  // Use Intl to resolve timezone offset
  const [hour, minute] = time.split(':').map(Number)
  const [year, month, day] = date.split('-').map(Number)
  // Create date string in the given timezone
  const localStr = `${date}T${time}:00`
  // Approximate offset via Intl
  const refDate = new Date(`${date}T${time}:00Z`)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(refDate)
  const p: Record<string, string> = {}
  for (const part of parts) if (part.type !== 'literal') p[part.type] = part.value
  const localizedDate = new Date(
    `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`
  )
  const offsetMs = localizedDate.getTime() - refDate.getTime()
  const utcDate = new Date(
    Date.UTC(year, month - 1, day, hour, minute) - offsetMs
  )
  void localStr // suppress unused warning
  return utcDate
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function formatUtcTime(date: Date): string {
  return date.toISOString().slice(11, 16) // "HH:MM"
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10) // "YYYY-MM-DD"
}
