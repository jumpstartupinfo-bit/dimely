import db from './db'
import { newId } from './utils'

/**
 * Store an in-app notification. Never throws and never blocks the caller: a failed insert is
 * logged, not left as an unhandled rejection.
 */
export function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  void Promise.resolve(
    db.run(
      `INSERT INTO notifications(id, user_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [newId(), userId, type, title, body, data ? JSON.stringify(data) : null],
    ),
  ).catch((err: unknown) => console.error('Failed to create notification:', err))
}
