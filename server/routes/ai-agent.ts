import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/ai-agent — get own agent
router.get('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const agent = db.prepare('SELECT * FROM ai_agents WHERE user_id = ?').get(user.id) as any
  if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

  const knowledge = db.prepare('SELECT * FROM agent_knowledge WHERE agent_id = ? AND is_active = 1 ORDER BY created_at ASC').all(agent.id) as any[]

  const activity = db.prepare(`
    SELECT * FROM agent_activity WHERE agent_id = ? ORDER BY created_at DESC LIMIT 20
  `).all(agent.id) as any[]

  res.json({ agent, knowledge, activity })
})

// PATCH /api/ai-agent — update permissions
router.patch('/', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const agent = db.prepare('SELECT id FROM ai_agents WHERE user_id = ?').get(user.id) as any
  if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

  const allowed = ['is_enabled', 'auto_confirm', 'respond_inquiries', 'decline_conflicts', 'allow_rescheduling', 'allow_vip_requests']
  const updates: string[] = []
  const vals: unknown[] = []

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`)
      vals.push(req.body[key] ? 1 : 0)
    }
  }

  if (updates.length === 0) { res.status(400).json({ error: 'No valid fields' }); return }
  updates.push(`updated_at = datetime('now')`)
  vals.push(agent.id)

  db.prepare(`UPDATE ai_agents SET ${updates.join(', ')} WHERE id = ?`).run(...vals)
  res.json({ ok: true })
})

// POST /api/ai-agent/knowledge — add knowledge item
router.post('/knowledge', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const agent = db.prepare('SELECT id FROM ai_agents WHERE user_id = ?').get(user.id) as any
  if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

  const { label, content } = req.body
  if (!label || !content) { res.status(400).json({ error: 'label and content required' }); return }

  const id = newId()
  db.prepare(`INSERT INTO agent_knowledge(id, agent_id, label, content) VALUES (?, ?, ?, ?)`).run(id, agent.id, label, content)
  res.status(201).json({ id, label, content })
})

// PATCH /api/ai-agent/knowledge/:id
router.patch('/knowledge/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const agent = db.prepare('SELECT id FROM ai_agents WHERE user_id = ?').get(user.id) as any
  if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

  const item = db.prepare('SELECT * FROM agent_knowledge WHERE id = ? AND agent_id = ?').get(req.params.id, agent.id) as any
  if (!item) { res.status(404).json({ error: 'Knowledge item not found' }); return }

  const { content, is_active } = req.body
  const updates: string[] = []
  const vals: unknown[] = []
  if (content !== undefined) { updates.push('content = ?'); vals.push(content) }
  if (is_active !== undefined) { updates.push('is_active = ?'); vals.push(is_active ? 1 : 0) }
  if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return }
  updates.push(`updated_at = datetime('now')`)
  vals.push(item.id)

  db.prepare(`UPDATE agent_knowledge SET ${updates.join(', ')} WHERE id = ?`).run(...vals)
  res.json({ ok: true })
})

// DELETE /api/ai-agent/knowledge/:id
router.delete('/knowledge/:id', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user
  const agent = db.prepare('SELECT id FROM ai_agents WHERE user_id = ?').get(user.id) as any
  if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }
  db.prepare('DELETE FROM agent_knowledge WHERE id = ? AND agent_id = ?').run(req.params.id, agent.id)
  res.json({ ok: true })
})

export default router
