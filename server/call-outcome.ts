/**
 * server/call-outcome.ts
 *
 * Call timing policy and the pure function that turns recorded attendance into an outcome.
 * No database or network access here, so every rule can be tested on its own.
 *
 * All times are milliseconds since the epoch (UTC).
 */

// ─── Policy (change values here only) ─────────────────────────────────────────
/** People may join this long before the booked start. */
export const JOIN_EARLY_MS = 10 * 60_000
/** After the booked end, everyone is removed from the room at this point. */
export const HARD_STOP_AFTER_END_MS = 5 * 60_000
/** A call is judged this long after the booked end, so late webhook events can arrive. */
export const FINALIZE_AFTER_END_MS = HARD_STOP_AFTER_END_MS + 60_000
/** A person counts as having shown up after this much time in the room. */
export const MIN_PRESENCE_MS = 2 * 60_000
/** After a qualifying call, the host's money is held this long for problems to be raised. */
export const DISPUTE_WINDOW_HOURS = 24
/** A booking that is never paid is expired after this long. */
export const UNPAID_EXPIRY_MINUTES = 60

/** Minimum time both people must be in the room together for a call to count as held. */
export function minOverlapMs(durationMins: number): number {
  return Math.min(5 * 60_000, durationMins * 60_000 * 0.5)
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Interval {
  startMs: number
  endMs: number
}

export type CallOutcome =
  | 'completed' // both were present together long enough
  | 'guest_no_show' // host showed up, the guest never tried to join
  | 'host_no_show' // guest showed up, the host never tried to join
  | 'both_no_show' // neither tried to join
  | 'needs_review' // anything unclear; money stays held for a person to decide

export interface OutcomeInput {
  startMs: number
  durationMins: number
  host: Interval[]
  guest: Interval[]
  /** True if the server ever issued this person a token to enter the room. */
  hostTokenIssued: boolean
  guestTokenIssued: boolean
}

export interface OutcomeResult {
  outcome: CallOutcome
  overlapMs: number
  hostMs: number
  guestMs: number
}

// ─── Interval helpers ─────────────────────────────────────────────────────────
function clampAndMerge(intervals: Interval[], lo: number, hi: number): Interval[] {
  const clipped = intervals
    .map((i) => ({ startMs: Math.max(i.startMs, lo), endMs: Math.min(i.endMs, hi) }))
    .filter((i) => i.endMs > i.startMs)
    .sort((a, b) => a.startMs - b.startMs)

  const merged: Interval[] = []
  for (const cur of clipped) {
    const last = merged[merged.length - 1]
    if (last && cur.startMs <= last.endMs) last.endMs = Math.max(last.endMs, cur.endMs)
    else merged.push({ ...cur })
  }
  return merged
}

function total(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + (i.endMs - i.startMs), 0)
}

function overlap(a: Interval[], b: Interval[]): number {
  let sum = 0
  for (const x of a) {
    for (const y of b) {
      const s = Math.max(x.startMs, y.startMs)
      const e = Math.min(x.endMs, y.endMs)
      if (e > s) sum += e - s
    }
  }
  return sum
}

// ─── The rules ────────────────────────────────────────────────────────────────
/**
 * Decide what happened on a call. Clear cases are settled automatically; anything that is
 * not clear returns `needs_review`, which keeps the money held for a person to decide.
 * A no-show is only declared when the missing person never even tried to join, so a gap in
 * attendance data can never cost someone their money.
 */
export function evaluateCallOutcome(input: OutcomeInput): OutcomeResult {
  const endMs = input.startMs + input.durationMins * 60_000
  const lo = input.startMs - JOIN_EARLY_MS
  const hi = endMs + HARD_STOP_AFTER_END_MS

  const host = clampAndMerge(input.host, lo, hi)
  const guest = clampAndMerge(input.guest, lo, hi)
  const hostMs = total(host)
  const guestMs = total(guest)
  const overlapMs = overlap(host, guest)

  const result = (outcome: CallOutcome): OutcomeResult => ({ outcome, overlapMs, hostMs, guestMs })

  if (overlapMs >= minOverlapMs(input.durationMins)) return result('completed')

  const hostShowed = hostMs >= MIN_PRESENCE_MS
  const guestShowed = guestMs >= MIN_PRESENCE_MS

  if (hostShowed && guestMs === 0 && !input.guestTokenIssued) return result('guest_no_show')
  if (guestShowed && hostMs === 0 && !input.hostTokenIssued) return result('host_no_show')
  if (hostMs === 0 && guestMs === 0 && !input.hostTokenIssued && !input.guestTokenIssued) {
    return result('both_no_show')
  }

  return result('needs_review')
}
