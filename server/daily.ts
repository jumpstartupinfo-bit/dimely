/**
 * server/daily.ts
 *
 * Server-side access to the Daily video API: private rooms, per-person meeting tokens, and
 * webhook signature verification. Server-only. Nothing here may be imported by src/.
 *
 * Environment variables:
 *   DAILY_API_KEY         - Daily API key
 *   DAILY_DOMAIN          - your Daily subdomain, for example "dimely" (or "dimely.daily.co")
 *   DAILY_WEBHOOK_SECRET  - base64 secret shared with Daily for webhook signatures; also used
 *                           to derive unguessable room names
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const API = 'https://api.daily.co/v1'

export function isDailyConfigured(): boolean {
  return Boolean(process.env.DAILY_API_KEY && process.env.DAILY_DOMAIN && process.env.DAILY_WEBHOOK_SECRET)
}

function apiKey(): string {
  const key = process.env.DAILY_API_KEY
  if (!key) throw new Error('DAILY_API_KEY is not set')
  return key
}

/** Room names are derived from the booking with a secret, so they cannot be guessed. */
export function roomNameFor(bookingId: string): string {
  const secret = process.env.DAILY_WEBHOOK_SECRET
  if (!secret) throw new Error('DAILY_WEBHOOK_SECRET is not set')
  return 'dm-' + createHmac('sha256', secret).update(bookingId).digest('hex').slice(0, 24)
}

export function roomUrlFor(roomName: string): string {
  const domain = (process.env.DAILY_DOMAIN ?? '').replace(/\.daily\.co.*$/, '').trim()
  if (!domain) throw new Error('DAILY_DOMAIN is not set')
  return `https://${domain}.daily.co/${roomName}`
}

async function dailyFetch(path: string, body: unknown): Promise<Response> {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Create the private room for a booking, or accept that it already exists. */
export async function ensureRoom(opts: { name: string; nbfSec: number; expSec: number }): Promise<void> {
  const res = await dailyFetch('/rooms', {
    name: opts.name,
    privacy: 'private',
    properties: {
      nbf: opts.nbfSec,
      exp: opts.expSec,
      eject_at_room_exp: true,
      max_participants: 2,
      enable_prejoin_ui: true,
      enable_chat: true,
      enable_knocking: false,
    },
  })
  if (res.ok) return
  const text = await res.text().catch(() => '')
  if (res.status === 400 && /already exists/i.test(text)) return
  throw new Error(`Daily room creation failed (${res.status}): ${text.slice(0, 200)}`)
}

/** Create a short-lived token that lets exactly one person into exactly one room. */
export async function createMeetingToken(opts: {
  roomName: string
  userId: string
  userName: string
  nbfSec: number
  expSec: number
  startVideoOff: boolean
}): Promise<string> {
  const res = await dailyFetch('/meeting-tokens', {
    properties: {
      room_name: opts.roomName,
      user_id: opts.userId,
      user_name: opts.userName,
      nbf: opts.nbfSec,
      exp: opts.expSec,
      eject_at_token_exp: true,
      is_owner: false,
      start_video_off: opts.startVideoOff,
      enable_screenshare: true,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Daily token creation failed (${res.status}): ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) throw new Error('Daily did not return a token')
  return data.token
}

/**
 * Verify a Daily webhook: HMAC-SHA256 over "<timestamp>.<body>" using the base64-decoded
 * secret, compared in constant time. The raw request body is checked first, because
 * re-serialising parsed JSON can change whitespace.
 */
export function verifyWebhookSignature(
  rawBody: string,
  parsedBody: unknown,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
): boolean {
  const secret = process.env.DAILY_WEBHOOK_SECRET
  if (!secret || !timestampHeader || !signatureHeader) return false

  const ts = Number(timestampHeader)
  if (!Number.isFinite(ts)) return false
  const tsSec = ts > 1e12 ? ts / 1000 : ts
  if (Math.abs(Date.now() / 1000 - tsSec) > 60 * 60) return false

  const key = Buffer.from(secret, 'base64')
  const provided = Buffer.from(signatureHeader, 'utf8')
  const candidates = [rawBody, JSON.stringify(parsedBody)]
  for (const body of candidates) {
    const expected = Buffer.from(
      createHmac('sha256', key).update(`${timestampHeader}.${body}`).digest('base64'),
      'utf8',
    )
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return true
  }
  return false
}
