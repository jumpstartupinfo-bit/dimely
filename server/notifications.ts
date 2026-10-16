import db from './db'
import { newId } from './utils'

export function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): void {
  try {
    db.prepare(`
      INSERT INTO notifications(id, user_id, type, title, body, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId(), userId, type, title, body, data ? JSON.stringify(data) : null)
  } catch (err) {
    console.error('Failed to create notification:', err)
  }
}
