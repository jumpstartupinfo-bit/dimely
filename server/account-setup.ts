/**
 * Every account needs four records: a wallet, a public profile, a referral code and an
 * agent settings row. This creates whichever of them are missing. It is safe to call any
 * number of times: it never touches a record that already exists.
 */
import db, { withTransaction } from './db'
import type { Tx } from './db'
import { newId, generateReferralCode, generateReferralSlug } from './utils'

export interface AccountSeed {
  id: string
  name: string
  username: string
}

const AVATAR_COLORS = ['#6366F1', '#0891B2', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777']

export function initialsFor(name: string, fallback: string): string {
  const source = name.trim() || fallback
  const letters = source.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase()
  return letters.slice(0, 2) || '?'
}

/** Create any missing account records using the given connection. Returns what it created. */
export async function provisionAccountRecords(q: Tx, user: AccountSeed): Promise<string[]> {
  const created: string[] = []
  const username = user.username.toLowerCase()

  if (!(await q.get('SELECT id FROM wallets WHERE user_id = $1', [user.id]))) {
    await q.run('INSERT INTO wallets(id, user_id) VALUES ($1, $2)', [newId(), user.id])
    created.push('wallet')
  }

  if (!(await q.get('SELECT id FROM profiles WHERE user_id = $1', [user.id]))) {
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]
    await q.run(
      `INSERT INTO profiles(id, user_id, username, name, headline, avatar_initials, avatar_color, published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [newId(), user.id, username, user.name, '', initialsFor(user.name, username), color, true],
    )
    created.push('profile')
  }

  if (!(await q.get('SELECT id FROM referral_codes WHERE user_id = $1', [user.id]))) {
    await q.run(
      'INSERT INTO referral_codes(id, user_id, code, link_slug) VALUES ($1, $2, $3, $4)',
      [newId(), user.id, generateReferralCode(username), generateReferralSlug(username)],
    )
    created.push('referral_code')
  }

  if (!(await q.get('SELECT id FROM ai_agents WHERE user_id = $1', [user.id]))) {
    await q.run('INSERT INTO ai_agents(id, user_id) VALUES ($1, $2)', [newId(), user.id])
    created.push('agent')
  }

  return created
}

/**
 * Repair an existing account that is missing records, for example one whose signup stopped
 * halfway. Cheap when nothing is missing (one read). Never throws: a repair failure must not
 * block someone from signing in.
 */
export async function ensureAccountRecords(userId: string): Promise<string[]> {
  try {
    const user = (await db.get('SELECT id, name, username FROM users WHERE id = $1', [userId])) as
      | { id: string; name: string | null; username: string | null }
      | undefined
    if (!user || !user.username) return []

    const counts = (await db.get(
      `SELECT (SELECT COUNT(*) FROM profiles WHERE user_id = $1) AS p,
              (SELECT COUNT(*) FROM wallets WHERE user_id = $1) AS w,
              (SELECT COUNT(*) FROM referral_codes WHERE user_id = $1) AS r,
              (SELECT COUNT(*) FROM ai_agents WHERE user_id = $1) AS a`,
      [userId],
    )) as { p: string | number; w: string | number; r: string | number; a: string | number } | undefined
    if (counts && Number(counts.p) > 0 && Number(counts.w) > 0 && Number(counts.r) > 0 && Number(counts.a) > 0) {
      return []
    }

    const created = await withTransaction((tx) =>
      provisionAccountRecords(tx, { id: user.id, name: user.name ?? '', username: user.username as string }),
    )
    if (created.length > 0) console.warn(`Repaired account ${userId}: created ${created.join(', ')}`)
    return created
  } catch (err) {
    console.error('Account repair failed:', err)
    return []
  }
}
