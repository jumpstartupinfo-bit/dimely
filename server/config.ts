import db from './db'

export function getConfig(key: string): string | null {
  const row = db.prepare('SELECT value FROM platform_config WHERE key = ?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setConfig(key: string, value: string): void {
  db.prepare(`
    INSERT INTO platform_config(key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).run(key, value)
}

export function getPlatformFeePercent(): number {
  return parseFloat(getConfig('platform_fee_percent') ?? '20')
}

export function getReferralCommissionPercent(): number {
  return parseFloat(getConfig('referral_commission_percent') ?? '20')
}

export function getReferralDurationMonths(): number {
  return parseInt(getConfig('referral_duration_months') ?? '12', 10)
}

export function isInviteOnly(): boolean {
  return (getConfig('invite_only') ?? 'false') === 'true'
}
