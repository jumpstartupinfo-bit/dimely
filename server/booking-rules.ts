/**
 * server/booking-rules.ts
 *
 * One place that defines when a booking may start. Both the list of available slots and the
 * booking request use these rules, so a slot that is hidden can never be booked by sending
 * the request directly.
 */

/** A booking must start at least this long from now (gives time to pay and to join). */
export const MIN_BOOKING_LEAD_MS = 15 * 60_000

/** Earliest start time (ms since epoch) that may be booked right now. */
export function earliestBookableMs(nowMs: number): number {
  return nowMs + MIN_BOOKING_LEAD_MS
}

/** True when a booking starting at `startMs` is far enough in the future. */
export function isBookableStart(startMs: number, nowMs: number): boolean {
  return Number.isFinite(startMs) && startMs >= earliestBookableMs(nowMs)
}

/**
 * True for a booking that was created at or after its own start time. Such a booking could
 * never have been attended, so neither person can fairly be judged a no-show.
 */
export function wasBookedAfterStart(createdMs: number, startMs: number): boolean {
  return Number.isFinite(createdMs) && Number.isFinite(startMs) && createdMs >= startMs
}

/** True when two time ranges [aStart, aEnd) and [bStart, bEnd) overlap. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}
