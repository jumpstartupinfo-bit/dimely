import { describe, expect, test } from 'bun:test'
import {
  MIN_BOOKING_LEAD_MS,
  earliestBookableMs,
  isBookableStart,
  rangesOverlap,
  wasBookedAfterStart,
} from './booking-rules'
import { localTimeToUtc } from './utils'

const NOW = Date.parse('2026-11-25T22:50:00Z')

describe('booking start rules', () => {
  test('a time that has already passed cannot be booked', () => {
    // The real case: 09:00 UTC booked at 22:50 UTC the same day
    const start = Date.parse('2026-11-25T09:00:00Z')
    expect(isBookableStart(start, NOW)).toBe(false)
  })

  test('a time starting in less than the minimum lead is refused', () => {
    expect(isBookableStart(NOW + MIN_BOOKING_LEAD_MS - 1, NOW)).toBe(false)
    expect(isBookableStart(NOW, NOW)).toBe(false)
  })

  test('a time exactly at the minimum lead, or later, is allowed', () => {
    expect(isBookableStart(NOW + MIN_BOOKING_LEAD_MS, NOW)).toBe(true)
    expect(isBookableStart(NOW + 24 * 3_600_000, NOW)).toBe(true)
  })

  test('garbage input is never bookable', () => {
    expect(isBookableStart(Number.NaN, NOW)).toBe(false)
    expect(isBookableStart(Number.POSITIVE_INFINITY, NOW)).toBe(false)
  })

  test('earliest bookable time is now plus the lead', () => {
    expect(earliestBookableMs(NOW)).toBe(NOW + MIN_BOOKING_LEAD_MS)
  })
})

describe('host time zone handling', () => {
  test('a Nairobi 09:00 slot is 06:00 UTC', () => {
    expect(localTimeToUtc('2026-11-26', '09:00', 'Africa/Nairobi').toISOString()).toBe('2026-11-26T06:00:00.000Z')
  })

  test('the same clock time is a different moment in a different zone', () => {
    const nairobi = localTimeToUtc('2026-11-26', '09:00', 'Africa/Nairobi').getTime()
    const utc = localTimeToUtc('2026-11-26', '09:00', 'UTC').getTime()
    expect(utc - nairobi).toBe(3 * 3_600_000)
  })

  test('slots are judged by the real moment, not the clock label', () => {
    // 09:00 in Nairobi on the 26th is 06:00 UTC. At 22:50 UTC on the 25th that is still a
    // valid, future slot, while 09:00 UTC on the 25th is long gone.
    const futureNairobi = localTimeToUtc('2026-11-26', '09:00', 'Africa/Nairobi').getTime()
    const pastUtc = localTimeToUtc('2026-11-25', '09:00', 'UTC').getTime()
    expect(isBookableStart(futureNairobi, NOW)).toBe(true)
    expect(isBookableStart(pastUtc, NOW)).toBe(false)
  })
})

describe('late bookings and overlap', () => {
  test('a booking created after its own start is flagged', () => {
    const start = Date.parse('2026-11-25T09:00:00Z')
    expect(wasBookedAfterStart(NOW, start)).toBe(true)
    expect(wasBookedAfterStart(start, start)).toBe(true)
  })

  test('a booking created before its start is normal', () => {
    const start = Date.parse('2026-11-26T09:00:00Z')
    expect(wasBookedAfterStart(NOW, start)).toBe(false)
  })

  test('ranges overlap only when they truly share time', () => {
    expect(rangesOverlap(0, 10, 5, 15)).toBe(true)
    expect(rangesOverlap(0, 10, 10, 20)).toBe(false)
    expect(rangesOverlap(10, 20, 0, 10)).toBe(false)
    expect(rangesOverlap(0, 10, 2, 4)).toBe(true)
  })
})
