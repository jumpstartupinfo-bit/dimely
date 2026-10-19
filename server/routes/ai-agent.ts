import { Router, Request, Response } from 'express'
import db from '../db'
import { requireAuth } from '../auth'
import { newId } from '../utils'

const router = Router()

// GET /api/ai-agent
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const agent = await db.get('SELECT * FROM ai_agents WHERE user_id = $1', [user.id])
    if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

    const knowledge = await db.all(
      'SELECT * FROM agent_knowledge WHERE agent_id = $1 AND is_active = true ORDER BY created_at ASC', [agent.id])
    const activity = await db.all(
      'SELECT * FROM agent_activity WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 20', [agent.id])

    res.json({ agent, knowledge, activity })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch AI agent.' })
  }
})

// PATCH /api/ai-agent
router.patch('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const agent = await db.get('SELECT id FROM ai_agents WHERE user_id = $1', [user.id])
    if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

    const allowed = ['is_enabled', 'auto_confirm', 'respond_inquiries', 'decline_conflicts', 'allow_rescheduling', 'allow_vip_requests']
    const updates: string[] = []
    const vals: unknown[] = []
    let paramIdx = 1

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${paramIdx++}`)
        vals.push(Boolean(req.body[key]))
      }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'No valid fields' }); return }
    updates.push(`updated_at = NOW()`)
    vals.push(agent.id)

    await db.run(`UPDATE ai_agents SET ${updates.join(', ')} WHERE id = $${paramIdx}`, vals)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AI agent.' })
  }
})

// POST /api/ai-agent/knowledge
router.post('/knowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const agent = await db.get('SELECT id FROM ai_agents WHERE user_id = $1', [user.id])
    if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

    const { label, content } = req.body
    if (!label || !content) { res.status(400).json({ error: 'label and content required' }); return }

    const id = newId()
    await db.run(`INSERT INTO agent_knowledge(id, agent_id, label, content) VALUES ($1, $2, $3, $4)`,
      [id, agent.id, label, content])
    res.status(201).json({ id, label, content })
  } catch (err) {
    res.status(500).json({ error: 'Failed to add knowledge item.' })
  }
})

// PATCH /api/ai-agent/knowledge/:id
router.patch('/knowledge/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const agent = await db.get('SELECT id FROM ai_agents WHERE user_id = $1', [user.id])
    if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }

    const { content, is_active } = req.body
    const updates: string[] = []
    const vals: unknown[] = []
    let paramIdx = 1

    if (content !== undefined) { updates.push(`content = $${paramIdx++}`); vals.push(content) }
    if (is_active !== undefined) { updates.push(`is_active = $${paramIdx++}`); vals.push(Boolean(is_active)) }
    if (updates.length === 0) { res.status(400).json({ error: 'No fields to update' }); return }

    updates.push(`updated_at = NOW()`)
    vals.push(req.params.id, agent.id)

    await db.run(`UPDATE agent_knowledge SET ${updates.join(', ')} WHERE id = $${paramIdx} AND agent_id = $${paramIdx + 1}`, vals)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update knowledge item.' })
  }
})

// DELETE /api/ai-agent/knowledge/:id
router.delete('/knowledge/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user
    const agent = await db.get('SELECT id FROM ai_agents WHERE user_id = $1', [user.id])
    if (!agent) { res.status(404).json({ error: 'AI agent not found' }); return }
    await db.run('DELETE FROM agent_knowledge WHERE id = $1 AND agent_id = $2', [req.params.id, agent.id])
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete knowledge item.' })
  }
})

export default router
