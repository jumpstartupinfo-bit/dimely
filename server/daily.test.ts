import { beforeAll, describe, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import { roomNameFor, verifyWebhookSignature } from './daily'

const SECRET_B64 = Buffer.from('a-test-secret-for-webhooks-only').toString('base64')

function sign(timestamp: string, body: string): string {
  return createHmac('sha256', Buffer.from(SECRET_B64, 'base64')).update(`${timestamp}.${body}`).digest('base64')
}

describe('webhook signature', () => {
  beforeAll(() => {
    process.env.DAILY_WEBHOOK_SECRET = SECRET_B64
  })

  const body = JSON.stringify({ type: 'participant.joined', payload: { session_id: 's1' } })
  const ts = String(Math.floor(Date.now() / 1000))

  test('accepts a correctly signed body', () => {
    expect(verifyWebhookSignature(body, JSON.parse(body), ts, sign(ts, body))).toBe(true)
  })

  test('rejects a body that was changed', () => {
    const tampered = body.replace('s1', 's2')
    expect(verifyWebhookSignature(tampered, JSON.parse(tampered), ts, sign(ts, body))).toBe(false)
  })

  test('rejects a wrong signature, a missing signature and a missing timestamp', () => {
    expect(verifyWebhookSignature(body, JSON.parse(body), ts, 'AAAA')).toBe(false)
    expect(verifyWebhookSignature(body, JSON.parse(body), ts, undefined)).toBe(false)
    expect(verifyWebhookSignature(body, JSON.parse(body), undefined, sign(ts, body))).toBe(false)
  })

  test('rejects a very old timestamp', () => {
    const old = String(Math.floor(Date.now() / 1000) - 3 * 3600)
    expect(verifyWebhookSignature(body, JSON.parse(body), old, sign(old, body))).toBe(false)
  })

  test('rejects everything when no secret is configured', () => {
    const saved = process.env.DAILY_WEBHOOK_SECRET
    delete process.env.DAILY_WEBHOOK_SECRET
    expect(verifyWebhookSignature(body, JSON.parse(body), ts, sign(ts, body))).toBe(false)
    process.env.DAILY_WEBHOOK_SECRET = saved
  })
})

describe('room names', () => {
  beforeAll(() => {
    process.env.DAILY_WEBHOOK_SECRET = SECRET_B64
  })

  test('are stable per booking, different between bookings, and not the booking id', () => {
    const a = roomNameFor('booking-1')
    expect(roomNameFor('booking-1')).toBe(a)
    expect(roomNameFor('booking-2')).not.toBe(a)
    expect(a.includes('booking-1')).toBe(false)
    expect(a.startsWith('dm-')).toBe(true)
  })
})
