import { describe, expect, test } from 'bun:test'
import { evaluateCallOutcome, minOverlapMs, type Interval } from './call-outcome'

const MIN = 60_000
const START = Date.UTC(2026, 10, 5, 11, 0, 0) // 11:00 UTC
const DURATION = 15

// Helper: an interval given in minutes relative to the booked start
const at = (fromMin: number, toMin: number): Interval => ({ startMs: START + fromMin * MIN, endMs: START + toMin * MIN })

const base = { startMs: START, durationMins: DURATION, hostTokenIssued: false, guestTokenIssued: false }

describe('evaluateCallOutcome', () => {
  test('both present together long enough: completed', () => {
    const r = evaluateCallOutcome({ ...base, host: [at(-2, 16)], guest: [at(0, 15)], hostTokenIssued: true, guestTokenIssued: true })
    expect(r.outcome).toBe('completed')
  })

  test('either person leaving early after the minimum overlap still counts as completed', () => {
    const r = evaluateCallOutcome({ ...base, host: [at(0, 7)], guest: [at(0, 15)], hostTokenIssued: true, guestTokenIssued: true })
    expect(r.outcome).toBe('completed')
  })

  test('together for less than the minimum: needs review, money stays held', () => {
    const r = evaluateCallOutcome({ ...base, host: [at(0, 3)], guest: [at(1, 15)], hostTokenIssued: true, guestTokenIssued: true })
    expect(r.outcome).toBe('needs_review')
  })

  test('guest never tried to join, host waited: guest no-show', () => {
    const r = evaluateCallOutcome({ ...base, host: [at(-5, 12)], guest: [], hostTokenIssued: true })
    expect(r.outcome).toBe('guest_no_show')
  })

  test('host never tried to join, guest waited: host no-show', () => {
    const r = evaluateCallOutcome({ ...base, host: [], guest: [at(-1, 12)], guestTokenIssued: true })
    expect(r.outcome).toBe('host_no_show')
  })

  test('nobody tried to join: both no-show', () => {
    const r = evaluateCallOutcome({ ...base, host: [], guest: [] })
    expect(r.outcome).toBe('both_no_show')
  })

  test('a person who was given access but has no recorded attendance is never called a no-show', () => {
    // Missing webhook data must not cost anyone their money.
    const guestMissing = evaluateCallOutcome({ ...base, host: [at(0, 12)], guest: [], hostTokenIssued: true, guestTokenIssued: true })
    expect(guestMissing.outcome).toBe('needs_review')
    const bothMissing = evaluateCallOutcome({ ...base, host: [], guest: [], hostTokenIssued: true, guestTokenIssued: true })
    expect(bothMissing.outcome).toBe('needs_review')
  })

  test('a very short visit does not count as showing up', () => {
    const r = evaluateCallOutcome({ ...base, host: [at(0, 1)], guest: [], hostTokenIssued: true })
    expect(r.outcome).toBe('needs_review')
  })

  test('a dropped connection and rejoin adds up across sessions', () => {
    const r = evaluateCallOutcome({
      ...base,
      host: [at(0, 15)],
      guest: [at(0, 2), at(4, 9)],
      hostTokenIssued: true,
      guestTokenIssued: true,
    })
    expect(r.overlapMs).toBe(7 * MIN)
    expect(r.outcome).toBe('completed')
  })

  test('overlapping duplicate sessions are not double counted', () => {
    const r = evaluateCallOutcome({
      ...base,
      host: [at(0, 4), at(2, 6)],
      guest: [at(0, 6)],
      hostTokenIssued: true,
      guestTokenIssued: true,
    })
    expect(r.hostMs).toBe(6 * MIN)
    expect(r.overlapMs).toBe(6 * MIN)
  })

  test('time outside the allowed window is ignored', () => {
    // Joined 30 minutes early and stayed to 30 minutes late: only the allowed window counts.
    const r = evaluateCallOutcome({ ...base, host: [at(-30, 45)], guest: [at(-30, 45)], hostTokenIssued: true, guestTokenIssued: true })
    // window is 10 minutes early to 5 minutes after the 15-minute end = 30 minutes
    expect(r.overlapMs).toBe(30 * MIN)
  })

  test('minimum overlap is five minutes, or half of a shorter call', () => {
    expect(minOverlapMs(15)).toBe(5 * MIN)
    expect(minOverlapMs(60)).toBe(5 * MIN)
    expect(minOverlapMs(8)).toBe(4 * MIN)
  })
})
