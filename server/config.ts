import db from './db'
import { numberInRange, percentOrDefault } from './percent'

/** Read one platform setting. Resolves to null when the setting is not stored. */
export async function getConfig(key: string): Promise<string | null> {
  const row = await db.get('SELECT value FROM platform_config WHERE key = $1', [key]) as { value: string } | undefined
  return row?.value ?? null
}

export async function setConfig(key: string, value: string): Promise<void> {
  await db.run(
    `INSERT INTO platform_config(key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  )
}

// The names below are the keys stored in the platform_config table.

/** Share of each booking kept by Dimely. */
export async function getPlatformFeePercent(): Promise<number> {
  return percentOrDefault(await getConfig('platform_fee_pct'), 20)
}

/** Share of Dimely's fee paid to a referrer. */
export async function getReferralCommissionPercent(): Promise<number> {
  return percentOrDefault(await getConfig('referral_pct'), 20)
}

/** How long a referral earns commission, in days. */
export async function getReferralDurationDays(): Promise<number> {
  return numberInRange(await getConfig('referral_duration_days'), 1, 3650, 365)
}

/** Smallest and largest total a single booking may cost, in USD. */
export async function getBookingAmountLimits(): Promise<{ min: number; max: number }> {
  const min = numberInRange(await getConfig('min_booking_amount'), 0, 1_000_000, 5)
  const max = numberInRange(await getConfig('max_booking_amount'), 0, 1_000_000, 10_000)
  return min <= max ? { min, max } : { min: 5, max: 10_000 }
}

/** Hours between a completed call and the host's earnings being released. */
export async function getSettlementDelayHours(): Promise<number> {
  return numberInRange(await getConfig('settlement_delay_hours'), 0, 720, 24)
}

export async function isInviteOnly(): Promise<boolean> {
  return ((await getConfig('invite_only')) ?? 'false') === 'true'
}
